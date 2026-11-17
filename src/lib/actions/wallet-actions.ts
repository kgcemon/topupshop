"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { depositSchema } from "@/lib/validation";
import { getSiteSettings } from "@/lib/data";
import { getPaymentMethodConfig } from "@/lib/payment-methods";
import type { ActionState } from "@/lib/actions/auth-actions";
import { claimMatchingPaymentSms } from "@/lib/payment-sms-match";
import {
  checkTransactionIdAvailable,
  claimTransactionId,
  TRANSACTION_ID_IN_USE_MESSAGE,
} from "@/lib/transaction-id";
import { findBanglaQrSmsForPayer, isBanglaQrActive, normalizeBdMobile } from "@/lib/bangla-qr";
import { claimPaymentSmsById } from "@/lib/payment-sms-match";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function depositAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "প্রথমে লগইন করুন।" };
  }

  const settings = await getSiteSettings();
  if (!settings.depositEnabled) {
    return { error: "ডিপোজিট আপাতত বন্ধ আছে।" };
  }
  if (!(await getPaymentMethodConfig()).manual.enabled) {
    return { error: "ম্যানুয়াল পেমেন্ট এই মুহূর্তে বন্ধ আছে।" };
  }

  if (formData.get("method") === "BANGLA_QR") {
    return depositByBanglaQr(session.user.id, settings, formData);
  }

  const parsed = depositSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    transactionId: formData.get("transactionId"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { amount, method, transactionId } = parsed.data;

  // A trx id must only ever back one thing site-wide — one deposit request
  // (approved or not) and never an order as well — otherwise the same real
  // payment can be resubmitted to farm multiple wallet credits, or spent once
  // here and once at checkout. See src/lib/transaction-id.ts.
  const availability = await checkTransactionIdAvailable(prisma, transactionId);
  if (!availability.available) {
    return { fieldErrors: { transactionId: availability.message } };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Re-check for a race (two submissions of the same trx id landing at
      // nearly the same time) now that we're inside the transaction.
      const raceCheck = await checkTransactionIdAvailable(tx, transactionId);
      if (!raceCheck.available) {
        throw new DepositError(raceCheck.message);
      }

      // Match on trx id + method only (not amount) — the customer's typed
      // amount is just their claim and may be wrong or inflated; if the trx id
      // matches, trust the SMS's actual amount as the source of truth and
      // credit that instead, rather than whatever the customer requested.
      const matched = await claimMatchingPaymentSms(tx, { method, trxId: transactionId });
      const creditedAmount = matched ? Math.round(Number(matched.amount)) : amount;

      const walletTx = await tx.walletTransaction.create({
        data: {
          userId: session.user.id,
          type: "DEPOSIT",
          method,
          amount: creditedAmount,
          transactionId,
          status: matched ? "APPROVED" : "PENDING",
          reviewedAt: matched ? new Date() : null,
          note:
            matched && creditedAmount !== amount
              ? `গ্রাহক ৳${amount} অনুরোধ করেছিলেন; SMS অনুযায়ী প্রকৃত পরিমাণ ৳${creditedAmount} যোগ করা হয়েছে।`
              : null,
        },
      });

      // Burn the trx id site-wide — see the same call in placeOrderAction.
      await claimTransactionId(tx, { trxId: transactionId, method, walletTransactionId: walletTx.id });

      if (matched) {
        await tx.paymentSms.update({
          where: { id: matched.id },
          data: { usedForWalletTransactionId: walletTx.id },
        });
        await tx.user.update({
          where: { id: session.user.id },
          data: { walletBalance: { increment: creditedAmount } },
        });
      }
    });
  } catch (error) {
    if (error instanceof DepositError) {
      return { fieldErrors: { transactionId: error.message } };
    }
    // Backstop for the DB-level unique constraint on transactionId, in case
    // two submissions of the same trx id land inside the race window above.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { transactionId: TRANSACTION_ID_IN_USE_MESSAGE } };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
  return { success: true };
}

class DepositError extends Error {}

// bKash below the minimum, paid through the Bangla QR — see bangla-qr.ts.
// The deposit is credited only when the bank's SMS fits it exactly (amount,
// masked payer number, time window); otherwise it waits as PENDING and
// /api/payment-sms settles it when the SMS lands.
async function depositByBanglaQr(
  userId: string,
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
  formData: FormData
): Promise<ActionState> {
  const amount = Number(formData.get("amount"));
  if (!Number.isInteger(amount) || amount < 20 || amount > 100000) {
    return { fieldErrors: { amount: "সঠিক অ্যামাউন্ট দিন (সর্বনিম্ন ২০ টাকা)" } };
  }
  if (!isBanglaQrActive(settings) || amount >= settings.bkashMinAmount) {
    return { error: "এই অ্যামাউন্টে Bangla QR পেমেন্ট চালু নেই। অন্য একটি মেথড বেছে নিন।" };
  }
  const payerNumber = normalizeBdMobile(String(formData.get("payerNumber") || ""));
  if (!payerNumber) {
    return { fieldErrors: { payerNumber: "যে বিকাশ নাম্বার থেকে টাকা পাঠিয়েছেন সেটি সঠিকভাবে লিখুন (01XXXXXXXXX)" } };
  }
  if (!checkRateLimit(`bangla-qr:${userId}`, 6, 10 * 60 * 1000) || !checkRateLimit(`bangla-qr:${await getClientIp()}`, 10, 10 * 60 * 1000)) {
    return { error: "অল্প সময়ে অনেকবার চেষ্টা করা হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.create({
        data: { userId, type: "DEPOSIT", method: "BANGLA_QR", amount, payerNumber, status: "PENDING" },
      });

      const { sms } = await findBanglaQrSmsForPayer(tx, { payerNumber, amount, at: walletTx.createdAt });
      if (!sms || !(await claimPaymentSmsById(tx, sms.id))) return;

      await claimTransactionId(tx, { trxId: sms.trxId, method: "BANGLA_QR", walletTransactionId: walletTx.id });
      await tx.paymentSms.update({ where: { id: sms.id }, data: { usedForWalletTransactionId: walletTx.id } });
      await tx.walletTransaction.update({
        where: { id: walletTx.id },
        data: { status: "APPROVED", reviewedAt: new Date(), transactionId: sms.trxId },
      });
      await tx.user.update({ where: { id: userId }, data: { walletBalance: { increment: amount } } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "এই পেমেন্টটি ইতিমধ্যে ব্যবহার হয়েছে। সাপোর্টে যোগাযোগ করুন।" };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
  revalidatePath("/admin/wallet-requests");
  return { success: true };
}
