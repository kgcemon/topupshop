import { prisma } from "@/lib/prisma";
import { callShellApi } from "@/lib/shell-client";
import { parseDenomRecipe } from "@/lib/unipin-fulfillment";
import type { FulfillmentResult } from "@/lib/order-fulfillment";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Same pattern as unipin-queue.ts's buildCallbackUrl — the secret is the
// active SHELL ApiSetting's apiSecret, echoed back on every callback so an
// unauthenticated POST can't fake a completed order.
function buildShellCallbackUrl(apiSecret: string | null): string {
  const params = new URLSearchParams({ secret: apiSecret ?? "" });
  return `${SITE_URL}/api/shell/callback?${params.toString()}`;
}

// One Shell call per entry in the denom recipe, exactly like UniPin redeems
// once per claimed code: "4,4" is two calls of "4", "LITE,LITE" two of "LITE".
// A recipe that parses to nothing (null/blank denom) still means a single call,
// with the empty package the vendor was already being sent before.
function shellCallParts(denom: string | null): string[] {
  const parts = parseDenomRecipe(denom);
  return parts.length > 0 ? parts : [""];
}

// Calls the Shell API for this order, once per denom part. Unlike UniPin,
// there's no local code-pool table to lock/claim inside a DB transaction — the
// "resource" being protected is entirely external, so the only way to make
// "check idempotency, then call" atomic against a concurrent/retried second
// caller is to atomically claim a local flag (Order.apiClaimedAt) first,
// before ever touching the network.
export async function fulfillShellOrder(orderId: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { rechargeOption: true } });

  const parts = shellCallParts(order.rechargeOption.denom);

  // Orders dispatched before part tracking existed have no counters to read,
  // so fall back to the old check: any successful Shell log means done.
  if (order.apiPartsTotal === null) {
    const alreadySucceeded = await prisma.apiCallLog.count({
      where: { orderId, deliveryMethod: "SHELL", success: true },
    });
    if (alreadySucceeded > 0) return { status: "already-fulfilled" };
  } else if (order.apiPartsSent >= order.apiPartsTotal) {
    return { status: "already-fulfilled" };
  }

  const apiSetting = await prisma.apiSetting.findFirst({
    where: { type: "SHELL", isActive: true },
  });
  if (!apiSetting?.endpoint) return { status: "insufficient" }; // no live Shell config

  // Order Lock — atomically claim the right to call Shell for this order right
  // now. No network call happens inside this update. The claim covers the whole
  // sequence of parts, not just one call, so a second caller can never
  // interleave its own parts with ours.
  const claim = await prisma.order.updateMany({
    where: { id: orderId, apiClaimedAt: null },
    data: { apiClaimedAt: new Date(), apiPartsTotal: parts.length },
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

  // Resume point: parts the vendor already accepted are never re-sent, so a
  // retry after a mid-sequence failure only pays for what's still missing.
  const callbackUrl = buildShellCallbackUrl(apiSetting.apiSecret);

  for (let index = order.apiPartsSent; index < parts.length; index++) {
    const result = await callShellApi({
      apiSettingId: apiSetting.id,
      endpoint: apiSetting.endpoint,
      username: apiSetting.apiKey,
      password: apiSetting.apiSecret,
      autocode: apiSetting.code,
      denom: parts[index],
      playerId: order.playerId,
      orderId: order.id,
      orderSerial: order.orderSerial,
      callbackUrl,
      // No dedicated "shell cost" field exists on the order yet — order.amount
      // (the BDT price) is the closest available number. Flag if the vendor's
      // shell_balance unit is actually something else (e.g. a fixed per-package
      // shell cost), so this can be corrected — a multi-part recipe sends this
      // once per part.
      shellBalance: order.amount,
    });

    if (!result.success) {
      // Stop at the first failure rather than burning balance on the rest, and
      // release the claim so a legitimate future retry can pick up from here.
      // apiPartsSent is left as-is: it is the resume point.
      await prisma.order.update({ where: { id: orderId }, data: { apiClaimedAt: null } });
      return { status: "failed", error: result.error };
    }

    // Record the part as sent immediately, one at a time — a crash between two
    // parts must not make a retry re-send the ones already accepted.
    await prisma.order.update({
      where: { id: orderId },
      data: { apiPartsSent: index + 1 },
    });
  }

  return { status: "fulfilled" };
}
