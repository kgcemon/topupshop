import { prisma } from "@/lib/prisma";
import { claimPaymentSmsById } from "@/lib/payment-sms-match";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { processOrderFulfillment } from "@/lib/order-fulfillment";
import { sendWalletTopupEmail } from "@/lib/mailer";
import { formatOrderNumber } from "@/lib/utils";
import { claimTransactionId } from "@/lib/transaction-id";
import { BANGLA_QR_MATCH_WINDOW_MS, maskedNumberMatches } from "@/lib/bangla-qr";
import type { DeliveryMethod } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// Settlement for the *late SMS* case: the customer submitted their order or
// wallet deposit before the gateway's payment SMS reached us, so at that
// moment there was nothing to match against and the request was parked as
// PENDING. This runs the same match in the other direction — a freshly stored
// PaymentSms looks for the PENDING request that was waiting for it.
//
// This path pays out money without a human in the loop, so it settles only on
// an exact three-way match: same payment method, same trx id, same amount.
// Anything else (over/underpayment, method mismatch, an already-reviewed
// request) is left completely untouched — SMS still UNUSED, request still
// PENDING — and admins get an alert instead. Deliberately narrower than the
// checkout-time matcher in placeOrderAction, which can adjust a wallet
// balance to cover a difference because a real customer is present and
// waiting; nobody is present here.
//
// Atomicity: the SMS is claimed (UNUSED -> USED) and the order/deposit is
// claimed (PENDING -> APPROVED) with conditional writes inside one
// transaction, and a lost race on either one rolls the whole thing back. So
// a duplicate delivery of the same SMS, or an admin approving by hand at the
// same instant, can never produce a double credit.

export type SettleResult =
  | { settled: "none" }
  | { settled: "order"; orderSerial: number }
  | { settled: "wallet"; amount: number };

class SettleAbort extends Error {}

type SettleOutcome =
  | { kind: "none" }
  | { kind: "order"; orderId: string; orderSerial: number; deliveryMethod: DeliveryMethod }
  | { kind: "wallet"; amount: number; email: string | null };

type PaymentSmsRow = NonNullable<Awaited<ReturnType<Prisma.TransactionClient["paymentSms"]["findUnique"]>>>;

// A Bangla QR SMS just arrived: look for the single PENDING Bangla QR order or
// deposit it pays for — same amount, payer number fitting the SMS's masked
// one, submitted within the match window. Exactly one candidate across orders
// AND deposits, or nothing happens (admins are told when it was ambiguous).
async function settleBanglaQrInTx(tx: Prisma.TransactionClient, sms: PaymentSmsRow): Promise<SettleOutcome> {
  const smsAmount = Number(sms.amount);
  if (!Number.isInteger(smsAmount)) return { kind: "none" };
  const window = {
    gte: new Date(sms.createdAt.getTime() - BANGLA_QR_MATCH_WINDOW_MS),
    lte: new Date(sms.createdAt.getTime() + BANGLA_QR_MATCH_WINDOW_MS),
  };

  const [orders, deposits] = await Promise.all([
    tx.order.findMany({
      where: { paymentMethod: "BANGLA_QR", status: "PENDING", amount: smsAmount, transactionId: null, createdAt: window },
      select: {
        id: true,
        orderSerial: true,
        userId: true,
        payerNumber: true,
        rechargeOption: { select: { deliveryMethod: true } },
      },
      take: 20,
    }),
    tx.walletTransaction.findMany({
      where: {
        type: "DEPOSIT",
        method: "BANGLA_QR",
        status: "PENDING",
        amount: smsAmount,
        transactionId: null,
        createdAt: window,
      },
      select: { id: true, userId: true, amount: true, payerNumber: true, user: { select: { email: true } } },
      take: 20,
    }),
  ]);

  const fitOrders = orders.filter((o) => o.payerNumber && maskedNumberMatches(sms.paymentNumber, o.payerNumber));
  const fitDeposits = deposits.filter((d) => d.payerNumber && maskedNumberMatches(sms.paymentNumber, d.payerNumber));
  const total = fitOrders.length + fitDeposits.length;

  if (total === 0) return { kind: "none" };
  if (total > 1) {
    await notifyAdmins(tx, {
      type: "ORDER_PAYMENT_MISMATCH",
      message: `⚠️ Bangla QR SMS (${sms.paymentNumber}, ৳${smsAmount}) এর সাথে ${total}টি পেন্ডিং অর্ডার/ডিপোজিট মিলে গেছে, তাই অটো অনুমোদন করা হয়নি। ম্যানুয়ালি পর্যালোচনা করুন।`,
      link: "/admin/store-sms",
    });
    return { kind: "none" };
  }

  if (!(await claimPaymentSmsById(tx, sms.id))) return { kind: "none" };

  if (fitOrders.length === 1) {
    const order = fitOrders[0];
    const approved = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING", transactionId: null },
      data: { status: "APPROVED", reviewedAt: new Date(), transactionId: sms.trxId },
    });
    if (approved.count === 0) throw new SettleAbort();
    await claimTransactionId(tx, { trxId: sms.trxId, method: "BANGLA_QR", orderId: order.id });
    await tx.paymentSms.update({ where: { id: sms.id }, data: { usedForOrderId: order.id } });
    if (order.userId) {
      await createNotification(tx, {
        userId: order.userId,
        type: "ORDER_NOTE",
        message: `আপনার Bangla QR পেমেন্ট নিশ্চিত হয়েছে — অর্ডার ${formatOrderNumber(order.orderSerial)} অনুমোদন করা হয়েছে।`,
        link: "/dashboard/orders",
      });
    }
    return {
      kind: "order",
      orderId: order.id,
      orderSerial: order.orderSerial,
      deliveryMethod: order.rechargeOption.deliveryMethod,
    };
  }

  const deposit = fitDeposits[0];
  const approved = await tx.walletTransaction.updateMany({
    where: { id: deposit.id, status: "PENDING", transactionId: null },
    data: { status: "APPROVED", reviewedAt: new Date(), transactionId: sms.trxId },
  });
  if (approved.count === 0) throw new SettleAbort();
  await claimTransactionId(tx, { trxId: sms.trxId, method: "BANGLA_QR", walletTransactionId: deposit.id });
  await tx.paymentSms.update({ where: { id: sms.id }, data: { usedForWalletTransactionId: deposit.id } });
  await tx.user.update({ where: { id: deposit.userId }, data: { walletBalance: { increment: deposit.amount } } });
  await createNotification(tx, {
    userId: deposit.userId,
    type: "ORDER_NOTE",
    message: `আপনার Bangla QR পেমেন্ট নিশ্চিত হয়েছে — ৳${deposit.amount} আপনার ওয়ালেটে যোগ করা হয়েছে।`,
    link: "/dashboard",
  });
  return { kind: "wallet", amount: deposit.amount, email: deposit.user.email };
}

export async function settlePendingWithPaymentSms(smsId: number): Promise<SettleResult> {
  let outcome: SettleOutcome;

  try {
    outcome = await prisma.$transaction(async (tx): Promise<SettleOutcome> => {
      const sms = await tx.paymentSms.findUnique({ where: { id: smsId } });
      // isActive false = balance-chain verification flagged it; never auto-settle
      // from an SMS an admin hasn't cleared.
      if (!sms || sms.status !== "UNUSED" || !sms.isActive) return { kind: "none" as const };

      // Bangla QR SMS carry no trx id the customer could have typed — they
      // are matched on amount + masked payer number + time instead.
      if (sms.method === "BANGLA_QR") return settleBanglaQrInTx(tx, sms);

      const smsAmount = Number(sms.amount);

      // Order.transactionId is unique, so this is the only order that can
      // ever have claimed this trx id.
      const order = await tx.order.findUnique({
        where: { transactionId: sms.trxId },
        select: {
          id: true,
          orderSerial: true,
          userId: true,
          amount: true,
          paymentMethod: true,
          status: true,
          rechargeOption: { select: { deliveryMethod: true } },
        },
      });

      if (order) {
        if (order.status !== "PENDING") return { kind: "none" as const };

        if (order.paymentMethod !== sms.method || order.amount !== smsAmount) {
          await notifyAdmins(tx, {
            type: "ORDER_PAYMENT_MISMATCH",
            message: `⚠️ অর্ডার ${formatOrderNumber(order.orderSerial)} এর TrxID ${sms.trxId} এর SMS এসেছে, কিন্তু মিল নেই — অর্ডার: ${order.paymentMethod} ৳${order.amount}, SMS: ${sms.method} ৳${smsAmount}। অর্ডারটি পেন্ডিং আছে এবং SMS ব্যবহার করা হয়নি, ম্যানুয়ালি পর্যালোচনা করুন।`,
            link: `/admin/orders?status=ALL&q=${order.orderSerial}`,
          });
          return { kind: "none" as const };
        }

        if (!(await claimPaymentSmsById(tx, sms.id))) return { kind: "none" as const };

        const approved = await tx.order.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: { status: "APPROVED", reviewedAt: new Date() },
        });
        // Someone reviewed it between our read and this write — abandon the
        // whole settlement rather than leaving the SMS spent on nothing.
        if (approved.count === 0) throw new SettleAbort();

        await tx.paymentSms.update({ where: { id: sms.id }, data: { usedForOrderId: order.id } });

        if (order.userId) {
          await createNotification(tx, {
            userId: order.userId,
            type: "ORDER_NOTE",
            message: `আপনার পেমেন্ট নিশ্চিত হয়েছে — অর্ডার ${formatOrderNumber(order.orderSerial)} অনুমোদন করা হয়েছে।`,
            link: "/dashboard/orders",
          });
        }

        return {
          kind: "order" as const,
          orderId: order.id,
          orderSerial: order.orderSerial,
          deliveryMethod: order.rechargeOption.deliveryMethod,
        };
      }

      // No order used this trx id — try a pending wallet deposit instead.
      // WalletTransaction.transactionId is unique too.
      const deposit = await tx.walletTransaction.findUnique({
        where: { transactionId: sms.trxId },
        select: {
          id: true,
          userId: true,
          type: true,
          method: true,
          amount: true,
          status: true,
          user: { select: { email: true } },
        },
      });

      if (!deposit || deposit.type !== "DEPOSIT" || deposit.status !== "PENDING") {
        return { kind: "none" as const };
      }

      if (deposit.method !== sms.method || deposit.amount !== smsAmount) {
        await notifyAdmins(tx, {
          type: "ORDER_PAYMENT_MISMATCH",
          message: `⚠️ ওয়ালেট রিকোয়েস্ট (TrxID ${sms.trxId}) এর SMS এসেছে, কিন্তু মিল নেই — রিকোয়েস্ট: ${deposit.method} ৳${deposit.amount}, SMS: ${sms.method} ৳${smsAmount}। রিকোয়েস্টটি পেন্ডিং আছে এবং SMS ব্যবহার করা হয়নি, ম্যানুয়ালি পর্যালোচনা করুন।`,
          link: "/admin/wallet-requests",
        });
        return { kind: "none" as const };
      }

      if (!(await claimPaymentSmsById(tx, sms.id))) return { kind: "none" as const };

      const approved = await tx.walletTransaction.updateMany({
        where: { id: deposit.id, status: "PENDING" },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
      if (approved.count === 0) throw new SettleAbort();

      await tx.paymentSms.update({
        where: { id: sms.id },
        data: { usedForWalletTransactionId: deposit.id },
      });
      await tx.user.update({
        where: { id: deposit.userId },
        data: { walletBalance: { increment: deposit.amount } },
      });
      await createNotification(tx, {
        userId: deposit.userId,
        type: "ORDER_NOTE",
        message: `আপনার পেমেন্ট নিশ্চিত হয়েছে — ৳${deposit.amount} আপনার ওয়ালেটে যোগ করা হয়েছে।`,
        link: "/dashboard",
      });

      return { kind: "wallet" as const, amount: deposit.amount, email: deposit.user.email };
    });
  } catch (error) {
    if (error instanceof SettleAbort) return { settled: "none" };
    throw error;
  }

  // Everything past this point is outside the transaction — it calls live
  // vendor APIs and SMTP, which must never hold DB locks or be able to undo a
  // committed approval. Mirrors updateOrderStatusAction / placeOrderAction.
  if (outcome.kind === "order") {
    await processOrderFulfillment(outcome.orderId, outcome.deliveryMethod, {
      orderSerial: outcome.orderSerial,
    });
    return { settled: "order", orderSerial: outcome.orderSerial };
  }

  if (outcome.kind === "wallet") {
    await sendWalletTopupEmail(outcome.email, { amount: outcome.amount });
    return { settled: "wallet", amount: outcome.amount };
  }

  return { settled: "none" };
}
