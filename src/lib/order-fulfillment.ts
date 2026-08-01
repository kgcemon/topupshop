import type { DeliveryMethod } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueUnipinFulfillmentJob, processUnipinFulfillmentJob } from "@/lib/unipin-queue";
import { fulfillShellOrder } from "@/lib/shell-fulfillment";
import { notifyAdmins } from "@/lib/notifications";
import { formatOrderNumber } from "@/lib/utils";

export type FulfillmentResult =
  | { status: "already-fulfilled" }
  | { status: "not-applicable" }
  | { status: "fulfilled" }
  | { status: "insufficient" }
  | { status: "failed"; error?: string };

// Single dispatch point for order fulfillment — routes to the delivery
// method's own isolated pipeline. UniPin and Shell never see each other's
// config or resources; MANUAL is a deliberate no-op (admin fulfills by hand).
// UNIPIN goes through a durable queue job (src/lib/unipin-queue.ts) — the
// job row is what guarantees exactly-once claiming/redeeming even across
// retried approvals, timeouts, or a server restart mid-flight.
export async function fulfillOrder(orderId: string, deliveryMethod: DeliveryMethod): Promise<FulfillmentResult> {
  if (deliveryMethod === "UNIPIN") {
    await enqueueUnipinFulfillmentJob(orderId);
    return processUnipinFulfillmentJob(orderId);
  }
  if (deliveryMethod === "SHELL") return fulfillShellOrder(orderId);
  return { status: "not-applicable" };
}

// Shared end-to-end handling of "an order just became eligible for
// fulfillment": dispatch, then either promote it to RUNNING (genuine success)
// or alert admins (insufficient stock/config, or a failed API call) — never
// silently leave an approved order stuck with no signal. Used by every path
// that can trigger fulfillment: WALLET auto-approval and an admin approving
// an order by hand. A failed/insufficient UniPin job stays queued (FAILED)
// and is retried the next time this order's approval is resubmitted — there
// is no periodic sweep; re-processing is always triggered by an explicit
// approval action, never a background timer.
export async function processOrderFulfillment(
  orderId: string,
  deliveryMethod: DeliveryMethod,
  notifyContext: { orderSerial: number; actorId?: string | null }
): Promise<FulfillmentResult> {
  const result = await fulfillOrder(orderId, deliveryMethod);

  if (result.status === "fulfilled" || result.status === "already-fulfilled") {
    await prisma.order.update({ where: { id: orderId }, data: { status: "RUNNING" } });
  } else if (result.status === "insufficient" || result.status === "failed") {
    await notifyAdmins(prisma, {
      actorId: notifyContext.actorId ?? null,
      type: "ORDER_FULFILLMENT_ISSUE",
      message: `⚠️ অর্ডার ${formatOrderNumber(notifyContext.orderSerial)} (${deliveryMethod}) fulfillment ব্যর্থ: ${
        result.status === "insufficient" ? "পর্যাপ্ত stock/config নেই" : (result.error ?? "API call ব্যর্থ")
      }`,
      link: "/admin/orders?status=APPROVED",
    });
  }

  return result;
}
