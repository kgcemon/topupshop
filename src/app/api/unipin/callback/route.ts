import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiCall } from "@/lib/api-log";
import { notifyAdmins } from "@/lib/notifications";
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
      if (order.status !== "RUNNING" && order.status !== "DELIVERED") {
        await prisma.order.update({ where: { id: order.id }, data: { status: "RUNNING" } });
      }
    }
  } else {
    const errorMessage = content ?? "UniPin callback ব্যর্থতা রিপোর্ট করেছে";
    await prisma.fulfillmentJob.updateMany({
      where: { orderId: order.id },
      data: { status: "FAILED", lastError: errorMessage },
    });
    // Surfaces the failure reason (e.g. "Invalid Player ID") directly on the
    // order for an admin to see — order status is left untouched so it stays
    // retryable via a resubmitted approval.
    await prisma.order.update({ where: { id: order.id }, data: { adminNote: errorMessage } });
    await notifyAdmins(prisma, {
      type: "ORDER_FULFILLMENT_ISSUE",
      message: `⚠️ অর্ডার ${formatOrderNumber(order.orderSerial)} (UNIPIN) fulfillment ব্যর্থ: ${errorMessage}`,
      link: "/admin/orders?status=APPROVED",
    });
  }

  return NextResponse.json({ ok: true });
}
