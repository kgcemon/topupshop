import { prisma } from "@/lib/prisma";
import { callShellApi } from "@/lib/shell-client";
import type { FulfillmentResult } from "@/lib/order-fulfillment";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Same pattern as unipin-queue.ts's buildCallbackUrl — the secret is the
// active SHELL ApiSetting's apiSecret, echoed back on every callback so an
// unauthenticated POST can't fake a completed order.
function buildShellCallbackUrl(apiSecret: string | null): string {
  const params = new URLSearchParams({ secret: apiSecret ?? "" });
  return `${SITE_URL}/api/shell/callback?${params.toString()}`;
}

// Calls the Shell API for this order. Unlike UniPin, there's no local code-pool
// table to lock/claim inside a DB transaction — the "resource" being protected
// is entirely external, so the only way to make "check idempotency, then call"
// atomic against a concurrent/retried second caller is to atomically claim a
// local flag (Order.shellClaimedAt) first, before ever touching the network.
export async function fulfillShellOrder(orderId: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { rechargeOption: true } });

  // Idempotency guard — has this order ever gotten a successful Shell call?
  // The ApiCallLog is the source of truth here, since there's no code row to check.
  const alreadySucceeded = await prisma.apiCallLog.count({
    where: { orderId, deliveryMethod: "SHELL", success: true },
  });
  if (alreadySucceeded > 0) return { status: "already-fulfilled" };

  const apiSetting = await prisma.apiSetting.findFirst({
    where: { type: "SHELL", isActive: true },
  });
  if (!apiSetting?.endpoint) return { status: "insufficient" }; // no live Shell config

  // Order Lock — atomically claim the right to call Shell for this order right
  // now. No network call happens inside this update.
  const claim = await prisma.order.updateMany({
    where: { id: orderId, shellClaimedAt: null },
    data: { shellClaimedAt: new Date() },
  });
  if (claim.count === 0) {
    // Someone else's call is already in flight (or just finished) for this
    // order — never call the API a second time concurrently. Re-check the
    // success log once more in case it finished between our two checks.
    const succeededMeanwhile = await prisma.apiCallLog.count({
      where: { orderId, deliveryMethod: "SHELL", success: true },
    });
    return succeededMeanwhile > 0 ? { status: "already-fulfilled" } : { status: "failed", error: "Shell call already in progress" };
  }

  const result = await callShellApi({
    apiSettingId: apiSetting.id,
    endpoint: apiSetting.endpoint,
    username: apiSetting.apiKey,
    password: apiSetting.apiSecret,
    autocode: apiSetting.code,
    denom: order.rechargeOption.denom,
    playerId: order.playerId,
    orderId: order.id,
    orderSerial: order.orderSerial,
    callbackUrl: buildShellCallbackUrl(apiSetting.apiSecret),
    // No dedicated "shell cost" field exists on the order yet — order.amount
    // (the BDT price) is the closest available number. Flag if the vendor's
    // shell_balance unit is actually something else (e.g. a fixed per-package
    // shell cost), so this can be corrected.
    shellBalance: order.amount,
  });

  if (!result.success) {
    // Release the claim so a legitimate future retry can call again.
    await prisma.order.update({ where: { id: orderId }, data: { shellClaimedAt: null } });
    return { status: "failed", error: result.error };
  }

  return { status: "fulfilled" };
}
