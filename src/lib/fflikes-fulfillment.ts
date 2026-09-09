import { prisma } from "@/lib/prisma";
import { callFFLikesApi } from "@/lib/fflikes-client";
import { parseDenomRecipe } from "@/lib/unipin-fulfillment";
import { deliverOrder } from "@/lib/order-delivery";
import type { FulfillmentResult } from "@/lib/order-fulfillment";

// One call per entry in the denom recipe, exactly like Shell: "100,100" is two
// 100-like calls, "200,200" two 200-like ones. A blank recipe still means a
// single call, which the client resolves to the default 100-like endpoint.
function fflikesCallParts(denom: string | null): string[] {
  const parts = parseDenomRecipe(denom);
  return parts.length > 0 ? parts : [""];
}

/**
 * Fulfills an FF Likes order by calling the vendor once per denom part.
 *
 * Unlike UniPin and Shell there is no callback: the vendor answers on the same
 * request, so once every part has succeeded the order is delivered here and
 * then. The claim + part counters work exactly as they do for Shell — a retry
 * after a mid-sequence failure resumes at the first unsent part, so likes the
 * vendor already sent (and billed) are never bought twice.
 */
export async function fulfillFFLikesOrder(orderId: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { rechargeOption: true },
  });

  const parts = fflikesCallParts(order.rechargeOption.denom);

  if (order.apiPartsTotal !== null && order.apiPartsSent >= order.apiPartsTotal) {
    return { status: "already-fulfilled" };
  }

  const apiSetting = await prisma.apiSetting.findFirst({
    where: { type: "FFLIKES", isActive: true },
  });
  if (!apiSetting?.apiKey) return { status: "insufficient" }; // no live FF Likes key

  // Claim the right to call for this order before touching the network, so two
  // concurrent dispatches can never interleave their parts. Covers the whole
  // sequence, not one call.
  const claim = await prisma.order.updateMany({
    where: { id: orderId, apiClaimedAt: null },
    data: { apiClaimedAt: new Date(), apiPartsTotal: parts.length },
  });
  if (claim.count === 0) {
    return { status: "failed", error: "FF Likes call already in progress" };
  }

  for (let index = order.apiPartsSent; index < parts.length; index++) {
    const result = await callFFLikesApi({
      apiSettingId: apiSetting.id,
      baseUrl: apiSetting.endpoint,
      apiKey: apiSetting.apiKey,
      serverName: apiSetting.code,
      denom: parts[index],
      playerId: order.playerId,
      orderId: order.id,
    });

    if (!result.success) {
      // Stop at the first failure instead of spending more of the daily limit,
      // and release the claim so a retry can pick up from this same part.
      await prisma.order.update({
        where: { id: orderId },
        data: { apiClaimedAt: null, adminNote: result.error },
      });
      return { status: "failed", error: result.error };
    }

    // Record each part the moment it lands, so a crash mid-sequence can't make
    // a retry re-send one the vendor already delivered and billed.
    await prisma.order.update({
      where: { id: orderId },
      data: { apiPartsSent: index + 1, apiPartsDone: index + 1 },
    });
  }

  // Every part landed and there is no callback to wait for — this order is done.
  await deliverOrder(orderId);
  return { status: "fulfilled" };
}
