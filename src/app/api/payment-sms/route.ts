import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePaymentSms } from "@/lib/payment-sms-parser";
import { notifyAdmins } from "@/lib/notifications";
import type { PaymentMethod } from "@/generated/prisma/enums";

function respond(status: boolean, message: string, code = 200) {
  return NextResponse.json({ status, message, timestamp: new Date().toISOString() }, { status: code });
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  WALLET: "Wallet",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};

// Which SiteSetting column holds the running-balance checkpoint for each method.
const CHECKPOINT_FIELD = {
  BKASH: "bkashBalanceCheckpoint",
  NAGAD: "nagadBalanceCheckpoint",
  ROCKET: "rocketBalanceCheckpoint",
} as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Receives forwarded payment SMS from the mobile app: { sender, sms }.
// `sender` is matched against the admin-managed SmsSender allow-list (exact
// string match — sender casing like "bKash" vs "NAGAD" varies by
// carrier/app, so admins add each variant explicitly). Only SMS that parse
// as a real payment notification for that sender's method get stored —
// everything else is acknowledged but dropped, same as the legacy webhook.
//
// `sender` names like "bKash"/"Nagad" aren't secret, so this route also
// requires a `?secret=` query param matching SiteSetting.paymentSmsSecret
// (set/rotated on /admin/sms-settings) — without it, anyone who found this
// URL could forge a payment SMS with a made-up trxId/amount and then redeem
// that same trxId through the wallet-deposit or checkout form for an
// instant, unearned balance credit. Mirrors the ?secret= check on
// src/app/api/shell/callback and src/app/api/unipin/callback.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret") ?? "";
  const siteSetting = await prisma.siteSetting.findUnique({
    where: { id: 1 },
    select: {
      paymentSmsSecret: true,
      paymentSmsBalanceVerifyEnabled: true,
      bkashBalanceCheckpoint: true,
      nagadBalanceCheckpoint: true,
      rocketBalanceCheckpoint: true,
    },
  });
  if (!siteSetting?.paymentSmsSecret || providedSecret !== siteSetting.paymentSmsSecret) {
    return respond(false, "Unauthorized", 401);
  }

  const text = await request.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return respond(false, "Invalid JSON", 400);
  }

  const sender = typeof body.sender === "string" ? body.sender.trim() : "";
  const sms = typeof body.sms === "string" ? body.sms : "";
  if (!sender || !sms) {
    return respond(false, "Missing required fields", 400);
  }

  const allowedSender = await prisma.smsSender.findFirst({ where: { name: sender, isActive: true } });
  if (!allowedSender) {
    return respond(true, "SMS received");
  }

  const parsed = parsePaymentSms(allowedSender.method, sms);
  if (!parsed) {
    return respond(true, "SMS received but not a valid payment notification");
  }

  const existing = await prisma.paymentSms.findUnique({ where: { trxId: parsed.trxId } });
  if (existing) {
    return respond(true, "Transaction ID already exists");
  }

  // Balance-chain verification: each method's SMS reports the account's
  // running balance after the transaction, so checkpoint + amount must equal
  // it. A mismatch usually means a forged/edited SMS (or a missed SMS broke
  // the chain) — either way the row is still stored for admin visibility but
  // starts inactive so it can't be auto-matched to an order/deposit.
  const method = allowedSender.method as "BKASH" | "NAGAD" | "ROCKET";
  const checkpointField = CHECKPOINT_FIELD[method];
  const checkpoint = siteSetting[checkpointField];
  let isActive = true;
  let checkpointUpdate: { [key: string]: number } | null = null;
  let mismatch: { expected: number; reported: number } | null = null;

  if (siteSetting.paymentSmsBalanceVerifyEnabled && parsed.balance !== undefined) {
    const reportedBalance = round2(Number(parsed.balance));
    const amount = round2(Number(parsed.amount));

    if (checkpoint === null) {
      // No baseline set yet for this method — bootstrap from the first SMS
      // instead of rejecting it, so verification kicks in from here on.
      checkpointUpdate = { [checkpointField]: reportedBalance };
    } else {
      const expectedBalance = round2(Number(checkpoint) + amount);
      if (Math.abs(expectedBalance - reportedBalance) > 0.01) {
        isActive = false;
        mismatch = { expected: expectedBalance, reported: reportedBalance };
      } else {
        checkpointUpdate = { [checkpointField]: reportedBalance };
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.paymentSms.create({
      data: {
        method: allowedSender.method,
        paymentNumber: parsed.paymentNumber,
        trxId: parsed.trxId,
        amount: parsed.amount,
        balance: parsed.balance ?? null,
        isActive,
      },
    });

    if (checkpointUpdate) {
      await tx.siteSetting.update({ where: { id: 1 }, data: checkpointUpdate });
    }

    if (mismatch) {
      await notifyAdmins(tx, {
        type: "PAYMENT_SMS_BALANCE_MISMATCH",
        message: `⚠️ ${METHOD_LABELS[allowedSender.method]} SMS (Trx: ${created.trxId}) এর balance ঠিক নেই — প্রত্যাশিত ৳${mismatch.expected}, SMS-এ এসেছে ৳${mismatch.reported}। এই SMS-টি Store SMS list এ যোগ হয়েছে কিন্তু disabled অবস্থায় আছে, রিভিউ করে প্রয়োজনে enable করুন।`,
        link: "/admin/store-sms",
      });
    }
  });

  return respond(true, "Payment SMS processed and stored successfully");
}
