"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { orderSchema, guestContactSchema } from "@/lib/validation";
import { generateOrderNumber } from "@/lib/utils";
import { getClientIp } from "@/lib/rate-limit";
import { isIpBlocked, applyAbuseBlock, detectMaliciousInput } from "@/lib/security";
import type { ActionState } from "@/lib/actions/auth-actions";
import { processOrderFulfillment } from "@/lib/order-fulfillment";

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

      return tx.order.create({
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
          status: paymentMethod === "WALLET" ? "APPROVED" : "PENDING",
          reviewedAt: paymentMethod === "WALLET" ? new Date() : null,
        },
      });
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
