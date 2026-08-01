import { prisma } from "@/lib/prisma";
import { purchaseUnipinCode } from "@/lib/unipin-client";
import type { FulfillmentResult } from "@/lib/order-fulfillment";

class InsufficientStockError extends Error {}

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

  // Atomically claim from whatever's now available (local + freshly bought),
  // using real row-level locking (SELECT ... FOR UPDATE) so two orders can
  // never end up claiming the same code. A single bounded retry absorbs the
  // rare case where two orders racing for the same denom pool right at its
  // capacity boundary both come up short on their first pre-lock candidate
  // window — that only ever produces an extra "insufficient" outcome, never
  // a double-allocation or partial commit.
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Lock Order — serializes any concurrent/retried call for this
        // exact order (API timeout retry, queue retry, cron re-run), on top
        // of the caller's own optimistic status claim.
        await tx.$queryRawUnsafe('SELECT id FROM `Order` WHERE id = ? FOR UPDATE', order.id);

        const stillLinked = await tx.unipinCode.count({ where: { usedForOrderId: order.id } });
        if (stillLinked > 0) return { status: "already-fulfilled" as const };

        const claimedIds: string[] = [];
        for (const [denom, needed] of neededByDenom) {
          // 2. Lock required UniPin rows + select unused codes in one locking
          // read. A locking read always returns the LATEST committed column
          // values once the lock is granted, so re-checking `status` on the
          // result (rather than trusting the pre-lock WHERE match) is what
          // makes this race-safe: a second concurrent claim for the same
          // denom blocks here until the first transaction commits, then sees
          // those exact rows as already USED and picks different ones.
          const locked = await tx.$queryRawUnsafe<{ id: string; status: string }[]>(
            "SELECT id, status FROM `UnipinCode` WHERE denom = ? AND status = ? ORDER BY createdAt ASC LIMIT ? FOR UPDATE",
            denom,
            "UNUSED",
            needed
          );
          const stillUnused = locked.filter((row) => row.status === "UNUSED");
          if (stillUnused.length < needed) {
            throw new InsufficientStockError(denom);
          }
          claimedIds.push(...stillUnused.map((row) => row.id));
        }

        // 3. Mark used + assign to order immediately, inside the same
        // transaction that holds the row locks — never wait for the API
        // call's success/failure to do this, since another order could
        // otherwise grab the same code in the meantime.
        await tx.unipinCode.updateMany({
          where: { id: { in: claimedIds }, status: "UNUSED" }, // defensive filter on top of the already-locked/verified rows
          data: { status: "USED", usedAt: new Date(), usedForOrderId: order.id },
        });
        return { status: "fulfilled" as const };
      });
    } catch (error) {
      if (!(error instanceof InsufficientStockError)) throw error;
      // fall through to retry (or exit the loop after the last attempt)
    }
  }

  return { status: "insufficient" };
}
