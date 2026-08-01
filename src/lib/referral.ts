import type { Prisma } from "@/generated/prisma/client";
import { formatOrderNumber } from "@/lib/utils";

/**
 * Credits both the referrer and the referred user with a wallet bonus the first time
 * one of the referred user's orders is marked DELIVERED (diamonds actually sent) — not
 * merely APPROVED. Safe to call on every DELIVERED transition: it no-ops once
 * `referralBonusGranted` is set, if there's no referrer, or if an earlier order of theirs
 * was already delivered.
 */
export async function grantFirstOrderReferralBonus(
  tx: Prisma.TransactionClient,
  params: {
    buyerId: string;
    orderId: string;
    orderSerial: number;
    orderAmount: number;
    reviewedById: string | null;
  }
) {
  const { buyerId, orderId, orderSerial, orderAmount, reviewedById } = params;

  const buyer = await tx.user.findUniqueOrThrow({ where: { id: buyerId } });
  if (!buyer.referredById || buyer.referralBonusGranted) return;

  const priorDeliveredOrders = await tx.order.count({
    where: { userId: buyer.id, status: "DELIVERED", NOT: { id: orderId } },
  });
  if (priorDeliveredOrders > 0) return;

  // Atomically claim the grant: only succeeds if still ungranted, so two orders of the
  // same buyer transitioning to DELIVERED concurrently can't both credit the bonus.
  const claimed = await tx.user.updateMany({
    where: { id: buyer.id, referralBonusGranted: false },
    data: { referralBonusGranted: true },
  });
  if (claimed.count === 0) return;

  const settings = await tx.siteSetting.findUnique({ where: { id: 1 } });
  const percent = settings?.referralBonusPercent ?? 1.5;
  const bonus = Math.round((orderAmount * percent) / 100);
  if (bonus <= 0) return;

  await tx.user.update({
    where: { id: buyer.id },
    data: { walletBalance: { increment: bonus } },
  });
  await tx.walletTransaction.create({
    data: {
      userId: buyer.id,
      type: "REFERRAL_BONUS",
      method: "WALLET",
      amount: bonus,
      status: "APPROVED",
      note: `রেফারেল বোনাস - আপনার প্রথম অর্ডার (${formatOrderNumber(orderSerial)})`,
      reviewedById,
      reviewedAt: new Date(),
    },
  });

  await tx.user.update({
    where: { id: buyer.referredById },
    data: { walletBalance: { increment: bonus } },
  });
  await tx.walletTransaction.create({
    data: {
      userId: buyer.referredById,
      type: "REFERRAL_BONUS",
      method: "WALLET",
      amount: bonus,
      status: "APPROVED",
      note: `রেফারেল বোনাস - ${buyer.name ?? buyer.email} এর প্রথম অর্ডার`,
      reviewedById,
      reviewedAt: new Date(),
    },
  });
}
