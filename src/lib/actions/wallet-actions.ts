"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { depositSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { claimMatchingPaymentSms } from "@/lib/payment-sms-match";

export async function depositAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "প্রথমে লগইন করুন।" };
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

  // A trx id must only ever back one deposit request, approved or not —
  // otherwise the same real payment can be resubmitted to farm multiple
  // wallet credits (or get accidentally double-approved by an admin).
  const existingUse = await prisma.walletTransaction.findFirst({ where: { transactionId } });
  if (existingUse) {
    return { fieldErrors: { transactionId: "এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার করা হয়েছে" } };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Re-check for a race (two submissions of the same trx id landing at
      // nearly the same time) now that we're inside the transaction.
      const raceCheck = await tx.walletTransaction.findFirst({ where: { transactionId } });
      if (raceCheck) {
        throw new DepositError("এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার করা হয়েছে");
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
      return { fieldErrors: { transactionId: "এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার করা হয়েছে" } };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
  return { success: true };
}

class DepositError extends Error {}
