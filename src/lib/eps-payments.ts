import { randomBytes, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { EpsPayment } from "@/generated/prisma/client";
import {
  EpsError,
  credentialsFrom,
  getPaymentGatewaySetting,
  initializeEpsPayment,
  verifyEpsTransaction,
  type EpsVerifyResult,
} from "@/lib/eps-client";
import { claimTransactionId } from "@/lib/transaction-id";
import { notifyAdmins, createNotification } from "@/lib/notifications";
import { processOrderFulfillment } from "@/lib/order-fulfillment";
import { sendWalletTopupEmail } from "@/lib/mailer";
import { resolveOrderCost } from "@/lib/profit";
import { generateOrderNumber, formatOrderNumber, formatTaka } from "@/lib/utils";

// The life of one EPS checkout:
//
//   startEpsPayment()   -> EpsPayment row (PENDING) + EPS session, customer redirected to EPS
//   customer pays on EPS, EPS sends them back to /api/eps/return/<ref>/<result>
//   refreshEpsPayment() -> asks EPS (server to server) what really happened
//   settleEpsPayment()  -> on a verified success, creates the order / credits the wallet, once
//
// refreshEpsPayment() is also what the background reconciler (eps-reconcile.ts),
// the status page's polling and the admin's "Check status" call, so a customer
// who pays and then closes the tab before the redirect still gets what they
// paid for within a minute or two.

export const EPS_RECONCILE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The trx id an EPS payment burns site-wide. The dash keeps it out of reach of
 * the manual trx-id field, which only accepts letters and digits. */
export function epsLedgerTrxId(merchantTransactionId: string) {
  return `EPS-${merchantTransactionId}`;
}

// ---------- Starting a payment ----------

export class EpsStartError extends Error {}

type StartInput = {
  purpose: "ORDER" | "DEPOSIT";
  amount: number;
  userId: string | null;
  ip: string;
  customer: { name: string; email: string; phone: string };
  productName: string;
  productCategory?: string;
  order?: {
    productId: number;
    rechargeOptionId: number;
    playerId: string;
    playerName: string | null;
    guestName: string | null;
    guestPhone: string | null;
  };
};

/** Digits only and at least 10 long, per the guide: Dhaka timestamp + random tail. */
function newMerchantTransactionId() {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `${stamp}${pad(randomInt(0, 1_000_000), 6)}`;
}

async function siteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env;

  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host");
  if (host) {
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (local ? "http" : "https");
    return `${proto}://${host}`;
  }
  return env || "http://localhost:3000";
}

export async function startEpsPayment(input: StartInput): Promise<{ redirectUrl: string; ref: string }> {
  const setting = await getPaymentGatewaySetting();
  const credentials = credentialsFrom(setting);
  if (!setting.epsEnabled || !credentials) {
    throw new EpsStartError("অটো পেমেন্ট এই মুহূর্তে চালু নেই। অন্য একটি পেমেন্ট মেথড ব্যবহার করুন।");
  }

  const origin = await siteOrigin();

  // The row goes in BEFORE EPS is called: if EPS opens the session but its
  // answer never reaches us, the reconciler still knows which transaction id
  // to ask about.
  let payment: EpsPayment | null = null;
  for (let attempt = 0; attempt < 3 && !payment; attempt++) {
    const merchantTransactionId = newMerchantTransactionId();
    try {
      payment = await prisma.epsPayment.create({
        data: {
          ref: randomBytes(16).toString("hex"),
          merchantTransactionId,
          customerOrderId: `TS${merchantTransactionId}`,
          purpose: input.purpose,
          amount: input.amount,
          userId: input.userId,
          ip: input.ip.slice(0, 64),
          productId: input.order?.productId ?? null,
          rechargeOptionId: input.order?.rechargeOptionId ?? null,
          playerId: input.order?.playerId ?? null,
          playerName: input.order?.playerName ?? null,
          guestName: input.order?.guestName ?? null,
          guestPhone: input.order?.guestPhone ?? null,
        },
      });
    } catch (error) {
      // Same-second collision on the random tail — just draw again.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }
  if (!payment) throw new EpsStartError("পেমেন্ট শুরু করা যায়নি, আবার চেষ্টা করুন।");

  const returnBase = `${origin}/api/eps/return/${payment.ref}`;
  try {
    const session = await initializeEpsPayment(credentials, {
      merchantTransactionId: payment.merchantTransactionId,
      customerOrderId: payment.customerOrderId,
      amount: input.amount,
      // The ref rides in the path, not the query string, so it survives
      // however EPS appends its own parameters.
      successUrl: `${returnBase}/success`,
      failUrl: `${returnBase}/fail`,
      cancelUrl: `${returnBase}/cancel`,
      ipAddress: input.ip === "unknown" ? "127.0.0.1" : input.ip,
      customer: input.customer,
      productName: input.productName,
      productCategory: input.productCategory,
      reference: payment.ref,
    });

    await prisma.epsPayment.update({
      where: { id: payment.id },
      data: { redirectUrl: session.redirectUrl },
    });
    return { redirectUrl: session.redirectUrl, ref: payment.ref };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // FAILED rather than deleted: the reconciler keeps re-checking it for a
    // while, in case EPS did open a session despite the error.
    await prisma.epsPayment.update({
      where: { id: payment.id },
      data: { status: "FAILED", lastError: message.slice(0, 2000) },
    });
    console.error("[eps] initialize failed:", message, error instanceof EpsError ? error.body : "");
    throw new EpsStartError("পেমেন্ট গেটওয়েতে এই মুহূর্তে সংযোগ করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।");
  }
}

// ---------- Checking and settling ----------

export type RefreshOutcome =
  | { kind: "settled"; payment: EpsPayment } // became SUCCESS just now
  | { kind: "unchanged"; payment: EpsPayment }
  | { kind: "error"; payment: EpsPayment; error: string };

/**
 * Re-checks one payment with EPS and applies the answer. Safe to call from
 * any number of places at once: settling is claimed atomically, and a
 * payment that is already SUCCESS is returned as is without calling EPS.
 *
 * `hint` is what the return URL said (success/fail/cancel). It is never
 * trusted for success; it only labels a payment EPS still calls pending
 * once the customer has come back from a failed or cancelled attempt.
 */
export async function refreshEpsPayment(
  paymentId: string,
  opts: { hint?: "success" | "fail" | "cancel" } = {}
): Promise<RefreshOutcome> {
  const payment = await prisma.epsPayment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status === "SUCCESS") return { kind: "unchanged", payment };

  const setting = await getPaymentGatewaySetting();
  const credentials = credentialsFrom(setting);
  if (!credentials) {
    return { kind: "error", payment, error: "EPS ক্রেডেনশিয়াল সেট করা নেই" };
  }

  let result: EpsVerifyResult;
  try {
    result = await verifyEpsTransaction(credentials, payment.merchantTransactionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated = await prisma.epsPayment.update({
      where: { id: payment.id },
      data: { lastError: message.slice(0, 2000), lastCheckedAt: new Date(), checkCount: { increment: 1 } },
    });
    return { kind: "error", payment: updated, error: message };
  }

  if (result.state === "SUCCESS") {
    const settled = await settleEpsPayment(payment.id, result);
    return settled ? { kind: "settled", payment: settled } : { kind: "unchanged", payment: await reload(payment.id) };
  }

  let status: EpsPayment["status"] = payment.status;
  if (result.state === "FAILED") status = "FAILED";
  else if (result.state === "CANCELLED") status = "CANCELLED";
  else if (opts.hint === "cancel") status = "CANCELLED";
  else if (opts.hint === "fail") status = "FAILED";

  // Never overwrite a SUCCESS some concurrent check just wrote.
  await prisma.epsPayment.updateMany({
    where: { id: payment.id, status: { not: "SUCCESS" } },
    data: {
      status,
      lastResponse: result.raw,
      lastError: null,
      financialEntity: result.financialEntity ?? payment.financialEntity,
      epsTransactionId: payment.epsTransactionId ?? (await freeEpsTransactionId(result.epsTransactionId, payment.id)),
      lastCheckedAt: new Date(),
      checkCount: { increment: 1 },
    },
  });
  return { kind: "unchanged", payment: await reload(payment.id) };
}

function reload(id: string) {
  return prisma.epsPayment.findUniqueOrThrow({ where: { id } });
}

// epsTransactionId is unique; never let a duplicate (EPS reusing an id across
// sessions) make the update that records a payment fail.
async function freeEpsTransactionId(epsTransactionId: string | null, paymentId: string) {
  if (!epsTransactionId) return null;
  const taken = await prisma.epsPayment.findFirst({
    where: { epsTransactionId, id: { not: paymentId } },
    select: { id: true },
  });
  return taken ? null : epsTransactionId;
}

class SettleSkip extends Error {}

/**
 * Turns a verified-paid EPS payment into what it was buying — exactly once.
 * Returns the settled row when this call did the settling, or null when the
 * payment had already been settled (by a concurrent check).
 */
async function settleEpsPayment(paymentId: string, result: EpsVerifyResult): Promise<EpsPayment | null> {
  const epsTransactionId = await freeEpsTransactionId(result.epsTransactionId, paymentId);
  const paidAmount = result.totalAmount !== null ? Math.round(result.totalAmount) : null;

  let afterCommit: (() => Promise<void>) | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // The single gate every caller passes through: only one of them can move
      // the row to SUCCESS, and everything below commits or rolls back with it.
      const claimed = await tx.epsPayment.updateMany({
        where: { id: paymentId, status: { not: "SUCCESS" } },
        data: {
          status: "SUCCESS",
          settledAt: new Date(),
          paidAmount,
          epsTransactionId,
          financialEntity: result.financialEntity,
          lastResponse: result.raw,
          lastError: null,
          lastCheckedAt: new Date(),
          checkCount: { increment: 1 },
        },
      });
      if (claimed.count === 0) throw new SettleSkip();

      const payment = await tx.epsPayment.findUniqueOrThrow({ where: { id: paymentId }, include: { user: true } });
      // EPS reported no amount at all: settle for what we asked, since EPS
      // only reports Success for the session we opened at that amount.
      const paid = paidAmount ?? payment.amount;
      const ledgerTrxId = epsLedgerTrxId(payment.merchantTransactionId);
      const via = result.financialEntity ? ` (${result.financialEntity})` : "";
      const epsRef = epsTransactionId ? ` · EPS TrxID ${epsTransactionId}` : "";

      if (payment.purpose === "DEPOSIT") {
        if (!payment.userId) throw new Error("EPS deposit without a user");
        const walletTx = await tx.walletTransaction.create({
          data: {
            userId: payment.userId,
            type: "DEPOSIT",
            method: "EPS",
            amount: paid,
            transactionId: ledgerTrxId,
            status: "APPROVED",
            reviewedAt: new Date(),
            note:
              paid !== payment.amount
                ? `EPS অটো পেমেন্ট${via}: অনুরোধ ৳${payment.amount}, প্রকৃত পরিশোধ ৳${paid} যোগ করা হয়েছে।${epsRef}`
                : `EPS অটো পেমেন্ট${via}${epsRef}`,
          },
        });
        await claimTransactionId(tx, { trxId: ledgerTrxId, method: "EPS", walletTransactionId: walletTx.id });
        await tx.user.update({ where: { id: payment.userId }, data: { walletBalance: { increment: paid } } });
        await tx.epsPayment.update({ where: { id: paymentId }, data: { walletTransactionId: walletTx.id } });

        const email = payment.user?.email;
        afterCommit = async () => {
          await sendWalletTopupEmail(email, { amount: paid }).catch(() => undefined);
        };
        return;
      }

      // ORDER
      const option =
        payment.rechargeOptionId !== null
          ? await tx.rechargeOption.findUnique({ where: { id: payment.rechargeOptionId }, include: { product: true } })
          : null;

      if (!option || !payment.playerId) {
        // The package was deleted while the customer was paying. The money is
        // real, so it goes to the wallet when there is one; otherwise an admin
        // has to sort it out by hand.
        if (payment.userId) {
          const walletTx = await tx.walletTransaction.create({
            data: {
              userId: payment.userId,
              type: "REFUND",
              method: "EPS",
              amount: paid,
              transactionId: ledgerTrxId,
              status: "APPROVED",
              reviewedAt: new Date(),
              note: `EPS পেমেন্ট${via}: প্যাকেজটি আর নেই, তাই ৳${paid} ওয়ালেটে যোগ করা হয়েছে।${epsRef}`,
            },
          });
          await claimTransactionId(tx, { trxId: ledgerTrxId, method: "EPS", walletTransactionId: walletTx.id });
          await tx.user.update({ where: { id: payment.userId }, data: { walletBalance: { increment: paid } } });
          await tx.epsPayment.update({ where: { id: paymentId }, data: { walletTransactionId: walletTx.id } });
          await createNotification(tx, {
            userId: payment.userId,
            type: "ORDER_NOTE",
            message: `আপনার পেমেন্ট ৳${paid} সফল হয়েছে, কিন্তু প্যাকেজটি আর পাওয়া যাচ্ছে না — টাকা আপনার ওয়ালেটে যোগ করা হয়েছে।`,
            link: "/dashboard",
          });
        } else {
          await tx.epsPayment.update({
            where: { id: paymentId },
            data: { lastError: "পেমেন্ট সফল, কিন্তু প্যাকেজটি মুছে ফেলা হয়েছে — গেস্টকে ম্যানুয়ালি সমাধান দিন।" },
          });
        }
        await notifyAdmins(tx, {
          type: "ORDER_PAYMENT_MISMATCH",
          message: `⚠️ EPS পেমেন্ট ৳${paid} (MTID ${payment.merchantTransactionId}) সফল, কিন্তু অর্ডারের প্যাকেজটি আর নেই। ${payment.userId ? "টাকা গ্রাহকের ওয়ালেটে যোগ করা হয়েছে।" : "গেস্ট অর্ডার — ম্যানুয়ালি সমাধান করুন।"}`,
          link: `/admin/eps-payments?q=${payment.merchantTransactionId}`,
        });
        return;
      }

      // Stock is taken now, not at checkout, so an abandoned payment never
      // holds a unit hostage. A paid order is created regardless; if the last
      // unit went meanwhile it simply waits for an admin instead of auto-running.
      const stockReserved = await tx.rechargeOption.updateMany({
        where: { id: option.id, OR: [{ stock: null }, { stock: { gt: 0 } }] },
        data: { stock: { decrement: 1 } },
      });
      const inStock = stockReserved.count > 0;
      const underpaid = paid < payment.amount;

      // Paying more than the order price is not refunded to the wallet: the
      // order simply goes through, and the note records what EPS charged.
      const notes: string[] = [`EPS অটো পেমেন্ট${via}: ৳${paid} পরিশোধিত${epsRef}`];
      if (underpaid) notes.push(`⚠️ কম পরিশোধ: অর্ডার মূল্য ৳${payment.amount}, EPS অনুযায়ী পরিশোধ ৳${paid} — ম্যানুয়ালি যাচাই করুন।`);
      if (!inStock) notes.push("⚠️ পেমেন্টের সময় প্যাকেজটি Stock Out ছিল — ম্যানুয়ালি প্রসেস করুন।");

      const autoApprove = inStock && !underpaid;
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: payment.userId,
          guestName: payment.guestName,
          guestPhone: payment.guestPhone,
          productId: option.productId,
          rechargeOptionId: option.id,
          playerId: payment.playerId,
          playerName: payment.playerName,
          amount: payment.amount,
          costAmount: await resolveOrderCost(tx, option),
          paymentMethod: "EPS",
          transactionId: ledgerTrxId,
          status: autoApprove ? "APPROVED" : "PENDING",
          reviewedAt: autoApprove ? new Date() : null,
          adminNote: notes.join("\n"),
        },
      });
      await claimTransactionId(tx, { trxId: ledgerTrxId, method: "EPS", orderId: order.id });
      await tx.epsPayment.update({ where: { id: paymentId }, data: { orderId: order.id } });

      if (!autoApprove) {
        await notifyAdmins(tx, {
          type: "ORDER_PAYMENT_MISMATCH",
          message: `💳 EPS অর্ডার ${formatOrderNumber(order.orderSerial)}: ${notes.slice(1).join(" ")}`,
          link: `/admin/orders?status=ALL&q=${order.orderSerial}`,
        });
      }

      if (autoApprove) {
        const orderId = order.id;
        const orderSerial = order.orderSerial;
        const deliveryMethod = option.deliveryMethod;
        afterCommit = async () => {
          await processOrderFulfillment(orderId, deliveryMethod, { orderSerial });
        };
      }
    });
  } catch (error) {
    if (error instanceof SettleSkip) return null;
    // The claim rolled back with everything else, so the payment is still
    // unsettled and the next check retries — but say why, loudly.
    const message = error instanceof Error ? error.message : String(error);
    console.error("[eps] settle failed:", message);
    await prisma.epsPayment
      .updateMany({ where: { id: paymentId, status: { not: "SUCCESS" } }, data: { lastError: `Settle failed: ${message}`.slice(0, 2000) } })
      .catch(() => undefined);
    await notifyAdmins(prisma, {
      type: "ORDER_PAYMENT_MISMATCH",
      message: `🚨 EPS পেমেন্ট সফল কিন্তু সেটেল করা যায়নি (${message.slice(0, 160)}) — EPS Payments পেজ থেকে Check status চাপুন।`,
      link: "/admin/eps-payments?status=PENDING",
    }).catch(() => undefined);
    throw error;
  }

  // Outside the transaction: fulfillment may call a live vendor API.
  const pending = afterCommit as (() => Promise<void>) | null;
  if (pending) {
    try {
      await pending();
    } catch (error) {
      console.error("[eps] post-settle step failed:", error);
    }
  }

  for (const path of ["/dashboard", "/dashboard/orders", "/dashboard/deposit", "/admin/orders", "/admin/eps-payments"]) {
    try {
      revalidatePath(path);
    } catch {
      // No request context (background reconciler) — nothing cached to drop.
    }
  }

  return reload(paymentId);
}

/** A short, customer-facing summary of a payment's state, for the status page. */
export function describeEpsPayment(p: Pick<EpsPayment, "status" | "amount" | "paidAmount">) {
  const amount = formatTaka(p.paidAmount ?? p.amount);
  switch (p.status) {
    case "SUCCESS":
      return { tone: "success" as const, title: "পেমেন্ট সফল হয়েছে", text: `৳${amount} সফলভাবে পরিশোধ হয়েছে।` };
    case "FAILED":
      return { tone: "error" as const, title: "পেমেন্ট সম্পন্ন হয়নি", text: "পেমেন্টটি ব্যর্থ হয়েছে। টাকা কাটা হয়ে থাকলে চিন্তা করবেন না — আমরা স্বয়ংক্রিয়ভাবে যাচাই করছি।" };
    case "CANCELLED":
      return { tone: "error" as const, title: "পেমেন্ট বাতিল করা হয়েছে", text: "আপনি পেমেন্টটি বাতিল করেছেন। চাইলে আবার চেষ্টা করতে পারেন।" };
    case "EXPIRED":
      return { tone: "error" as const, title: "পেমেন্টের মেয়াদ শেষ", text: "এই পেমেন্ট সেশনটির মেয়াদ শেষ হয়ে গেছে। টাকা কাটা হয়ে থাকলে সাপোর্টে যোগাযোগ করুন।" };
    default:
      return { tone: "pending" as const, title: "পেমেন্ট যাচাই করা হচ্ছে...", text: "অনুগ্রহ করে এই পেজটি বন্ধ করবেন না। পেমেন্ট নিশ্চিত হলেই আপডেট হয়ে যাবে।" };
  }
}
