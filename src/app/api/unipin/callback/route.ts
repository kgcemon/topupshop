import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiCall } from "@/lib/api-log";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { grantFirstOrderReferralBonus } from "@/lib/referral";
import { formatOrderNumber } from "@/lib/utils";

// Receives UniPin's async redeem-status callback — the `url` we send as part
// of every redeem request in unipin-client.ts. Some UniPin deployments also
// resolve the redeem call synchronously; this is handled idempotently either
// way (a code that already has redeemedAt set is never re-marked).
//
// Payload contract:
//   success: { status: "success", content, nickname, orderid }
//   failure: { status: "failed", content, orderid, shell_balance, playerid }
// `orderid` is the order's orderSerial, exactly what we sent as `orderid` in
// the original redeem request body.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const text = await request.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderSerial = Number(body.orderid);
  if (!Number.isFinite(orderSerial)) {
    return NextResponse.json({ error: "missing orderid" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { orderSerial } });
  if (!order) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }

  // The secret is the active UNIPIN ApiSetting's apiSecret, embedded in the
  // callback URL we handed UniPin at redeem time (see buildCallbackUrl in
  // unipin-queue.ts) — without this check, anyone who guessed an orderSerial
  // could POST a fake "success" here and get an order marked complete for
  // free.
  const apiSetting = await prisma.apiSetting.findFirst({ where: { type: "UNIPIN", isActive: true } });
  const providedSecret = url.searchParams.get("secret") ?? "";
  if (!apiSetting?.apiSecret || providedSecret !== apiSetting.apiSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = typeof body.status === "string" ? body.status : "";
  const content = typeof body.content === "string" && body.content ? body.content : undefined;
  const success = status === "success";

  await logApiCall({
    orderId: order.id,
    apiSettingId: apiSetting.id,
    deliveryMethod: "UNIPIN",
    responseBody: text,
    success,
    errorMessage: success ? undefined : (content ?? "UniPin callback ব্যর্থতা রিপোর্ট করেছে"),
  });

  if (success) {
    // The callback doesn't identify which specific code it's confirming, only
    // the order — in practice one redeem call (and one callback) happens per
    // code, so mark whichever of this order's claimed codes haven't redeemed
    // yet.
    await prisma.unipinCode.updateMany({
      where: { usedForOrderId: order.id, redeemedAt: null },
      data: { redeemedAt: new Date() },
    });

    const remaining = await prisma.unipinCode.count({
      where: { usedForOrderId: order.id, redeemedAt: null },
    });
    if (remaining === 0) {
      await prisma.fulfillmentJob.updateMany({
        where: { orderId: order.id },
        data: { status: "COMPLETED" },
      });

      // UniPin confirming "success" here means the code has actually reached
      // the player — that's the real DELIVERED moment, not just RUNNING (an
      // HTTP 200 on the redeem call only means the request was accepted; see
      // unipin-client.ts). Mirrors what updateOrderStatusAction does when an
      // admin manually marks an order DELIVERED: first-order referral bonus
      // + customer notification, both of which are safe to call unconditionally
      // (each no-ops on a repeat/callback replay).
      if (order.status !== "DELIVERED") {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });

          if (order.userId) {
            await grantFirstOrderReferralBonus(tx, {
              buyerId: order.userId,
              orderId: order.id,
              orderSerial: order.orderSerial,
              orderAmount: order.amount,
              reviewedById: null,
            });

            await createNotification(tx, {
              userId: order.userId,
              type: "ORDER_COMPLETED",
              message: `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} সফলভাবে ডেলিভার হয়েছে!`,
              link: "/dashboard/orders",
            });
          }
        });
      }
    }
  } else {
    const errorMessage = content ?? "UniPin callback ব্যর্থতা রিপোর্ট করেছে";
    await prisma.fulfillmentJob.updateMany({
      where: { orderId: order.id },
      data: { status: "FAILED", lastError: errorMessage },
    });
    // Surfaces the failure reason (e.g. "Invalid Player ID") directly on the
    // order for an admin to see. Marking AUTO_FAILED (rather than leaving
    // status untouched) puts it front-and-center on the AUTO FAILED tab —
    // still retryable, since resubmitting APPROVED only checks for
    // RUNNING/DELIVERED.
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "AUTO_FAILED", adminNote: errorMessage },
    });
    await notifyAdmins(prisma, {
      type: "ORDER_FULFILLMENT_ISSUE",
      message: `⚠️ অর্ডার ${formatOrderNumber(order.orderSerial)} (UNIPIN) fulfillment ব্যর্থ: ${errorMessage}`,
      link: "/admin/orders?status=APPROVED",
    });
  }

  return NextResponse.json({ ok: true });
}
