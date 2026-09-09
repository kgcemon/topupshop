import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { grantFirstOrderReferralBonus } from "@/lib/referral";
import { formatOrderNumber } from "@/lib/utils";
import { sendOrderDeliveredEmail } from "@/lib/mailer";

/**
 * Marks an order DELIVERED and runs everything that hangs off that: the buyer's
 * first-order referral bonus, their in-app notification, and the confirmation
 * email.
 *
 * Safe to call more than once for the same order — the status change is claimed
 * with a conditional update, so a second call (a duplicate vendor callback, a
 * retried dispatch) returns false and grants nothing twice. Returns true only
 * for the call that actually delivered it.
 */
export async function deliverOrder(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true },
  });

  const claimed = await prisma.order.updateMany({
    where: { id: orderId, status: { notIn: ["DELIVERED", "REFUNDED"] } },
    data: { status: "DELIVERED" },
  });
  if (claimed.count === 0) return false;

  // Guest orders have no account to credit or notify.
  if (order.userId) {
    await prisma.$transaction(async (tx) => {
      await grantFirstOrderReferralBonus(tx, {
        buyerId: order.userId!,
        orderId: order.id,
        orderSerial: order.orderSerial,
        orderAmount: order.amount,
        reviewedById: null,
      });

      await createNotification(tx, {
        userId: order.userId!,
        type: "ORDER_COMPLETED",
        message: `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} সফলভাবে ডেলিভার হয়েছে!`,
        link: "/dashboard/orders",
      });
    });
  }

  // Best-effort and outside the transaction — never let a slow or broken SMTP
  // server hold DB locks or fail the delivery it is only confirming.
  await sendOrderDeliveredEmail(order.user?.email, {
    orderNumber: formatOrderNumber(order.orderSerial),
    amount: order.amount,
  });

  return true;
}
