import { prisma } from "@/lib/prisma";
import { purchaseUnipinCode } from "@/lib/unipin-client";

export type FulfillmentResult =
  | { status: "already-fulfilled" }
  | { status: "not-applicable" }
  | { status: "fulfilled" }
  | { status: "insufficient" };

function parseDenomRecipe(denom: string | null): string[] {
  return (denom ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function tally(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

// Claims (or, if short, buys via the active Unipin API and then claims) one
// Unipin code per token in the order's recharge-option denom recipe, and
// links them to the order. Safe to call multiple times for the same order —
// once any code is already linked, every call after that is a no-op, so a
// re-approval (however triggered) can never claim a second code.
export async function fulfillUnipinOrder(orderId: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { rechargeOption: true },
  });

  const alreadyLinked = await prisma.unipinCode.count({ where: { usedForOrderId: order.id } });
  if (alreadyLinked > 0) return { status: "already-fulfilled" };

  const tokens = parseDenomRecipe(order.rechargeOption.denom);
  if (tokens.length === 0) return { status: "not-applicable" };

  const neededByDenom = tally(tokens);

  // Top up any denom that's short on local stock via the active Unipin API
  // setting. Network calls stay outside any DB transaction — a slow request
  // must never hold a transaction (and its locks) open.
  for (const [denom, needed] of neededByDenom) {
    const available = await prisma.unipinCode.count({ where: { denom, status: "UNUSED" } });
    const shortfall = needed - available;
    if (shortfall <= 0) continue;

    const apiSetting = await prisma.apiSetting.findFirst({
      where: { type: "UNIPIN", isActive: true },
    });
    if (!apiSetting?.endpoint) continue; // no live API configured — surfaces as "insufficient" below

    for (let i = 0; i < shortfall; i++) {
      const result = await purchaseUnipinCode({
        apiSettingId: apiSetting.id,
        endpoint: apiSetting.endpoint,
        apiKey: apiSetting.apiKey,
        apiSecret: apiSetting.apiSecret,
        denom,
        playerId: order.playerId,
        orderId: order.id,
      });
      if (!result.success) break; // stop for this denom; whatever was bought stays as usable stock
      await prisma.unipinCode.create({
        data: { denom, code: result.code, status: "UNUSED", source: apiSetting.name },
      });
    }
  }

  // Atomically claim from whatever's now available (local + freshly bought).
  return prisma.$transaction(async (tx) => {
    const stillLinked = await tx.unipinCode.count({ where: { usedForOrderId: order.id } });
    if (stillLinked > 0) return { status: "already-fulfilled" as const };

    const denoms = [...neededByDenom.keys()];
    const counts = await Promise.all(
      denoms.map((denom) => tx.unipinCode.count({ where: { denom, status: "UNUSED" } }))
    );
    const fullyStocked = denoms.every((denom, i) => counts[i] >= (neededByDenom.get(denom) ?? 0));
    if (!fullyStocked) return { status: "insufficient" as const };

    const claimedIds: string[] = [];
    for (const [denom, needed] of neededByDenom) {
      const picks = await tx.unipinCode.findMany({
        where: { denom, status: "UNUSED" },
        orderBy: { createdAt: "asc" },
        take: needed,
        select: { id: true },
      });
      claimedIds.push(...picks.map((p) => p.id));
    }
    await tx.unipinCode.updateMany({
      where: { id: { in: claimedIds } },
      data: { status: "USED", usedAt: new Date(), usedForOrderId: order.id },
    });
    return { status: "fulfilled" as const };
  });
}
