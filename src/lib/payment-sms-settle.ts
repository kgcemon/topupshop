import { prisma } from "@/lib/prisma";
import { claimPaymentSmsById } from "@/lib/payment-sms-match";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { processOrderFulfillment } from "@/lib/order-fulfillment";
import { sendWalletTopupEmail } from "@/lib/mailer";
import { formatOrderNumber } from "@/lib/utils";
import type { DeliveryMethod } from "@/generated/prisma/enums";

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

export async function settlePendingWithPaymentSms(smsId: number): Promise<SettleResult> {
  let outcome:
    | { kind: "none" }
    | { kind: "order"; orderId: string; orderSerial: number; deliveryMethod: DeliveryMethod }
    | { kind: "wallet"; amount: number; email: string | null };

  try {
    outcome = await prisma.$transaction(async (tx) => {
      const sms = await tx.paymentSms.findUnique({ where: { id: smsId } });
      // isActive false = balance-chain verification flagged it; never auto-settle
      // from an SMS an admin hasn't cleared.
      if (!sms || sms.status !== "UNUSED" || !sms.isActive) return { kind: "none" as const };

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
