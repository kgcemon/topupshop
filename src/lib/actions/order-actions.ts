"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { orderSchema, guestContactSchema } from "@/lib/validation";
import { generateOrderNumber, formatOrderNumber } from "@/lib/utils";
import { getClientIp } from "@/lib/rate-limit";
import { isIpBlocked, applyAbuseBlock, detectMaliciousInput } from "@/lib/security";
import type { ActionState } from "@/lib/actions/auth-actions";
import { processOrderFulfillment } from "@/lib/order-fulfillment";
import { findUnusedPaymentSms, claimPaymentSmsById } from "@/lib/payment-sms-match";
import { notifyAdmins, createNotification } from "@/lib/notifications";

export type OrderActionState = ActionState & {
  order?: {
    orderSerial: number;
    productName: string;
    optionLabel: string;
    playerId: string;
    playerName: string | null;
    amount: number;
    paymentMethod: string;
    transactionId: string | null;
    status: string;
    createdAt: string;
  };
};

export async function placeOrderAction(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const session = await auth();
  const ip = await getClientIp();

  let userId: string | null = null;
  let guestName: string | null = null;
  let guestPhone: string | null = null;

  if (session?.user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isBlocked: true, blockedUntil: true },
    });
    const isCurrentlyBlocked =
      dbUser?.isBlocked && (!dbUser.blockedUntil || dbUser.blockedUntil > new Date());
    if (isCurrentlyBlocked) {
      return { error: "আপনার একাউন্টটি ব্লক করা হয়েছে, তাই অর্ডার করা যাচ্ছে না।" };
    }
    userId = session.user.id;
  } else {
    if (await isIpBlocked(ip)) {
      return { error: "সন্দেহজনক কার্যকলাপের কারণে আপনার আইপি সাময়িকভাবে ব্লক করা হয়েছে। ২৪ ঘণ্টা পর আবার চেষ্টা করুন।" };
    }

    const settings = await prisma.siteSetting.findUnique({
      where: { id: 1 },
      select: { allowGuestOrders: true },
    });
    if (!settings?.allowGuestOrders) {
      return { error: "অর্ডার করতে হলে প্রথমে লগইন করুন।" };
    }

    const guestParsed = guestContactSchema.safeParse({
      guestName: formData.get("guestName"),
      guestPhone: formData.get("guestPhone"),
    });
    if (!guestParsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of guestParsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { fieldErrors };
    }
    if (detectMaliciousInput(guestParsed.data.guestName, guestParsed.data.guestPhone)) {
      await applyAbuseBlock({ userId: null, ip, reason: "গেস্ট অর্ডার ফর্মে সন্দেহজনক ইনপুট সনাক্ত হয়েছে" });
      return { error: "সন্দেহজনক ইনপুট সনাক্ত হয়েছে। নিরাপত্তার কারণে আপনার আইপি ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
    }
    if (formData.get("paymentMethod") === "WALLET") {
      return { error: "গেস্ট অর্ডারে ওয়ালেট পেমেন্ট ব্যবহার করা যাবে না।" };
    }
    guestName = guestParsed.data.guestName;
    guestPhone = guestParsed.data.guestPhone;
  }

  const parsed = orderSchema.safeParse({
    productId: formData.get("productId"),
    rechargeOptionId: formData.get("rechargeOptionId"),
    playerId: formData.get("playerId"),
    playerName: formData.get("playerName") || undefined,
    paymentMethod: formData.get("paymentMethod"),
    transactionId: formData.get("transactionId") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { productId, rechargeOptionId, playerId, playerName, paymentMethod, transactionId } =
    parsed.data;

  if (detectMaliciousInput(playerId, playerName, transactionId)) {
    await applyAbuseBlock({ userId, ip, reason: "অর্ডার ফর্মে সন্দেহজনক ইনপুট সনাক্ত হয়েছে" });
    return { error: "সন্দেহজনক ইনপুট সনাক্ত হয়েছে। নিরাপত্তার কারণে ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
  }

  const option = await prisma.rechargeOption.findFirst({
    where: { id: rechargeOptionId, productId, isActive: true },
    include: { product: true },
  });
  if (!option) {
    return { error: "সিলেক্ট করা রিচার্জ অপশনটি খুঁজে পাওয়া যায়নি।" };
  }

  if (option.stock !== null && option.stock <= 0) {
    return { error: "এই রিচার্জ অপশনটি বর্তমানে Stock Out।" };
  }

  if (paymentMethod !== "WALLET" && !transactionId) {
    return { fieldErrors: { transactionId: "ট্রানজেকশন আইডি দিন" } };
  }

  if (transactionId) {
    const existingOrder = await prisma.order.findUnique({ where: { transactionId } });
    if (existingOrder) {
      return { fieldErrors: { transactionId: "এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার করা হয়েছে" } };
    }
  }

  let createdOrder;
  try {
    createdOrder = await prisma.$transaction(async (tx) => {
      // Atomically reserve one unit of stock (no-op when stock is unmanaged/null,
      // since MySQL keeps NULL - 1 as NULL). Fails the whole transaction if
      // another request already sold the last unit.
      const stockReserved = await tx.rechargeOption.updateMany({
        where: {
          id: rechargeOptionId,
          OR: [{ stock: null }, { stock: { gt: 0 } }],
        },
        data: { stock: { decrement: 1 } },
      });
      if (stockReserved.count === 0) {
        throw new OrderError("এই রিচার্জ অপশনটি বর্তমানে Stock Out।");
      }

      if (paymentMethod === "WALLET") {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId! } });
        if (user.walletBalance < option.price) {
          throw new OrderError("ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। দয়া করে ওয়ালেটে টাকা যোগ করুন।");
        }

        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: { decrement: option.price } },
        });

        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: "PURCHASE",
            method: "WALLET",
            amount: option.price,
            status: "APPROVED",
            note: `Order payment for ${option.label}`,
            reviewedAt: new Date(),
          },
        });
      }

      // For manual bKash/Nagad/Rocket payments, check whether the trx id the
      // customer typed matches an unused SMS the payment gateway already
      // forwarded us. Three cases, keyed off the SMS's real amount (never the
      // customer's typed amount, which isn't collected/trusted here anyway):
      //   - equals the order price: auto-approve as before.
      //   - more than the order price: auto-approve and credit the excess to
      //     the buyer's wallet (registered users only — a guest has no wallet
      //     to credit, so that case falls through to manual review below).
      //   - less than the order price: leave the SMS UNUSED (it hasn't fully
      //     paid for anything yet) and leave the order PENDING for manual
      //     admin review, with a note explaining the shortfall so the admin
      //     isn't left guessing why it didn't auto-approve.
      let matchedSmsId: number | null = null;
      let autoApproved = false;
      let mismatchNote: string | null = null;
      let overpayExcess: number | null = null;
      let shortfallDeducted: number | null = null;

      if (paymentMethod !== "WALLET" && transactionId) {
        const smsRow = await findUnusedPaymentSms(tx, { method: paymentMethod, trxId: transactionId });
        if (smsRow) {
          const smsAmount = Number(smsRow.amount);

          if (smsAmount === option.price) {
            if (await claimPaymentSmsById(tx, smsRow.id)) {
              matchedSmsId = smsRow.id;
              autoApproved = true;
            }
          } else if (smsAmount > option.price && userId) {
            if (await claimPaymentSmsById(tx, smsRow.id)) {
              matchedSmsId = smsRow.id;
              autoApproved = true;
              overpayExcess = smsAmount - option.price;
              mismatchNote = `গ্রাহক SMS অনুযায়ী ৳${smsAmount} পাঠিয়েছেন, অর্ডারের মূল্য ৳${option.price}। বাড়তি ৳${overpayExcess} তার ওয়ালেটে যোগ করা হয়েছে। (TrxID: ${transactionId})`;

              await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: overpayExcess } },
              });
              await tx.walletTransaction.create({
                data: {
                  userId,
                  type: "REFUND",
                  method: paymentMethod,
                  amount: overpayExcess,
                  status: "APPROVED",
                  reviewedAt: new Date(),
                  note: `TrxID ${transactionId}: পাঠানো ৳${smsAmount} - অর্ডারের মূল্য ৳${option.price} = বাড়তি ৳${overpayExcess} ওয়ালেটে যোগ করা হলো।`,
                },
              });
            }
          } else if (smsAmount > option.price) {
            // Overpaid guest order — no wallet to credit into, so leave it for manual handling.
            mismatchNote = `⚠️ গেস্ট অর্ডারে বাড়তি টাকা পাঠানো হয়েছে (SMS: ৳${smsAmount}, অর্ডার: ৳${option.price})। গেস্ট একাউন্টে ওয়ালেট নেই বলে যোগ করা যায়নি, ম্যানুয়ালি সমাধান করুন। SMS ব্যবহার করা হয়নি।`;
          } else if (userId) {
            // Underpaid order from a registered user — cover the shortfall from
            // their wallet and auto-approve, mirroring the overpay branch above.
            // Only claim the SMS (and touch the wallet) once we know the wallet
            // can actually cover the rest; otherwise leave everything untouched
            // and fall back to manual review, same as the guest case.
            const shortfall = option.price - smsAmount;
            const buyer = await tx.user.findUniqueOrThrow({ where: { id: userId } });

            if (buyer.walletBalance >= shortfall) {
              if (await claimPaymentSmsById(tx, smsRow.id)) {
                matchedSmsId = smsRow.id;
                autoApproved = true;
                shortfallDeducted = shortfall;
                mismatchNote = `গ্রাহক SMS অনুযায়ী ৳${smsAmount} পাঠিয়েছেন, অর্ডারের মূল্য ৳${option.price}। বাকি ৳${shortfall} তার ওয়ালেট থেকে কেটে অর্ডার অনুমোদন করা হয়েছে। (TrxID: ${transactionId})`;

                await tx.user.update({
                  where: { id: userId },
                  data: { walletBalance: { decrement: shortfall } },
                });
                await tx.walletTransaction.create({
                  data: {
                    userId,
                    type: "PURCHASE",
                    method: "WALLET",
                    amount: shortfall,
                    status: "APPROVED",
                    reviewedAt: new Date(),
                    note: `TrxID ${transactionId}: অর্ডার ${option.label} - SMS এ পাঠানো ৳${smsAmount}, বাকি ৳${shortfall} ওয়ালেট থেকে কাটা হলো।`,
                  },
                });
              } else {
                mismatchNote = `⚠️ পেমেন্ট কম হয়েছে: গ্রাহক TrxID ${transactionId} দিয়ে মাত্র ৳${smsAmount} পাঠিয়েছেন, কিন্তু অর্ডারের মূল্য ৳${option.price}। SMS দাবি করা যায়নি, ম্যানুয়ালি পর্যালোচনা করুন।`;
              }
            } else {
              mismatchNote = `⚠️ পেমেন্ট কম হয়েছে: গ্রাহক TrxID ${transactionId} দিয়ে মাত্র ৳${smsAmount} পাঠিয়েছেন (অর্ডার মূল্য ৳${option.price})। বাকি ৳${shortfall} মেটানোর মতো ওয়ালেট ব্যালেন্স (৳${buyer.walletBalance}) নেই, তাই অর্ডারটি পেন্ডিং রাখা হলো। SMS ব্যবহার করা হয়নি, ম্যানুয়ালি পর্যালোচনা করুন।`;
            }
          } else {
            mismatchNote = `⚠️ পেমেন্ট কম হয়েছে: গ্রাহক TrxID ${transactionId} দিয়ে মাত্র ৳${smsAmount} পাঠিয়েছেন, কিন্তু অর্ডারের মূল্য ৳${option.price}। SMS ব্যবহার করা হয়নি, ম্যানুয়ালি পর্যালোচনা করুন।`;
          }
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          guestName,
          guestPhone,
          productId,
          rechargeOptionId,
          playerId,
          playerName: playerName || null,
          amount: option.price,
          paymentMethod,
          transactionId: paymentMethod === "WALLET" ? null : transactionId,
          status: paymentMethod === "WALLET" || autoApproved ? "APPROVED" : "PENDING",
          reviewedAt: paymentMethod === "WALLET" || autoApproved ? new Date() : null,
          adminNote: mismatchNote,
        },
      });

      if (matchedSmsId !== null) {
        await tx.paymentSms.update({ where: { id: matchedSmsId }, data: { usedForOrderId: order.id } });
      }

      if (overpayExcess !== null) {
        await notifyAdmins(tx, {
          type: "ORDER_PAYMENT_MISMATCH",
          message: `💰 অর্ডার ${formatOrderNumber(order.orderSerial)}: গ্রাহক ৳${overpayExcess} বেশি পাঠিয়েছিলেন, বাড়তি টাকা তার ওয়ালেটে যোগ করা হয়েছে।`,
          link: `/admin/orders?status=ALL&q=${order.orderSerial}`,
        });
        // userId is guaranteed set here — this branch only runs for registered buyers (see condition above).
        await createNotification(tx, {
          userId: userId!,
          type: "ORDER_NOTE",
          message: `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} এর জন্য আপনি ৳${overpayExcess} বেশি পাঠিয়েছিলেন। বাড়তি টাকা আপনার ওয়ালেটে যোগ করা হয়েছে।`,
          link: "/dashboard",
        });
      }

      if (shortfallDeducted !== null) {
        await notifyAdmins(tx, {
          type: "ORDER_PAYMENT_MISMATCH",
          message: `💰 অর্ডার ${formatOrderNumber(order.orderSerial)}: গ্রাহক ৳${shortfallDeducted} কম পাঠিয়েছিলেন, বাকি টাকা তার ওয়ালেট থেকে কেটে অর্ডার অনুমোদন করা হয়েছে।`,
          link: `/admin/orders?status=ALL&q=${order.orderSerial}`,
        });
        // userId is guaranteed set here — this branch only runs for registered buyers (see condition above).
        await createNotification(tx, {
          userId: userId!,
          type: "ORDER_NOTE",
          message: `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} এর জন্য আপনি ৳${shortfallDeducted} কম পাঠিয়েছিলেন। বাকি টাকা আপনার ওয়ালেট থেকে কেটে অর্ডারটি অনুমোদন করা হয়েছে।`,
          link: "/dashboard",
        });
      }

      return order;
    });
  } catch (error) {
    if (error instanceof OrderError) {
      return { error: error.message };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { transactionId: "এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার করা হয়েছে" } };
    }
    throw error;
  }

  // A WALLET order is auto-approved above — immediately attempt fulfillment
  // too (via whichever delivery method this option uses), same as an admin
  // approving a manual order, so the buyer doesn't end up silently stuck at
  // APPROVED until an admin happens to resubmit the status form. Runs outside
  // the transaction above since it may call a live API.
  let finalStatus: string = createdOrder.status;
  if (createdOrder.status === "APPROVED") {
    const result = await processOrderFulfillment(createdOrder.id, option.deliveryMethod, {
      orderSerial: createdOrder.orderSerial,
    });
    if (result.status === "fulfilled" || result.status === "already-fulfilled") {
      finalStatus = "RUNNING";
    }
  }

  revalidatePath("/dashboard/orders");
  return {
    success: true,
    order: {
      orderSerial: createdOrder.orderSerial,
      productName: option.product.name,
      optionLabel: option.label,
      playerId: createdOrder.playerId,
      playerName: createdOrder.playerName,
      amount: createdOrder.amount,
      paymentMethod: createdOrder.paymentMethod,
      transactionId: createdOrder.transactionId,
      status: finalStatus,
      createdAt: createdOrder.createdAt.toISOString(),
    },
  };
}

class OrderError extends Error {}
