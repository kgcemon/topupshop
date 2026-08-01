import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiCall } from "@/lib/api-log";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { grantFirstOrderReferralBonus } from "@/lib/referral";
import { formatOrderNumber } from "@/lib/utils";

// Mirrors src/app/api/unipin/callback/route.ts — same vendor/payload shape
// (status/content/orderid, same tgbotid), just for SHELL orders (see
// shell-client.ts). Unconfirmed for Shell specifically since only the
// request body was given for this delivery method so far; adjust the
// status/content parsing below once the real Shell callback payload is
// confirmed against ApiCallLog.
//
// Unlike UniPin there's no local code pool to mark redeemed — success here
// means the order itself is done, so it goes straight to DELIVERED.
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

  // The secret is the active SHELL ApiSetting's apiSecret, embedded in the
  // callback URL we handed the vendor at call time (see buildShellCallbackUrl
  // in shell-fulfillment.ts) — without this check, anyone who guessed an
  // orderSerial could POST a fake "success" here and get an order marked
  // complete for free.
  const apiSetting = await prisma.apiSetting.findFirst({ where: { type: "SHELL", isActive: true } });
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
    deliveryMethod: "SHELL",
    responseBody: text,
    success,
    errorMessage: success ? undefined : (content ?? "Shell callback ব্যর্থতা রিপোর্ট করেছে"),
  });

  if (success) {
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
  } else {
    const errorMessage = content ?? "Shell callback ব্যর্থতা রিপোর্ট করেছে";
    // Release the Shell claim too, so a resubmitted approval can call the
    // API again instead of being blocked by the earlier in-flight claim.
    await prisma.order.update({
      where: { id: order.id },
      data: { adminNote: errorMessage, shellClaimedAt: null },
    });
    await notifyAdmins(prisma, {
      type: "ORDER_FULFILLMENT_ISSUE",
      message: `⚠️ অর্ডার ${formatOrderNumber(order.orderSerial)} (SHELL) fulfillment ব্যর্থ: ${errorMessage}`,
      link: "/admin/orders?status=APPROVED",
    });
  }

  return NextResponse.json({ ok: true });
}
