import { prisma } from "@/lib/prisma";
import type { UnipinCode } from "@/generated/prisma/client";

class InsufficientStockError extends Error {}

export function parseDenomRecipe(denom: string | null): string[] {
  return (denom ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function tally(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

export type ClaimResult =
  | { status: "already-claimed"; codes: UnipinCode[] }
  | { status: "not-applicable" }
  | { status: "insufficient" }
  | { status: "claimed"; codes: UnipinCode[] }
  // A set of codes IS linked to this order, but it doesn't exactly match
  // what the recipe requires (wrong count, or right count but wrong denom
  // mix) — this should be structurally impossible given the all-or-nothing
  // claim transaction below, but it's checked explicitly and unconditionally
  // before any redeem call is ever allowed to happen: an incomplete/wrong
  // set must NEVER reach the API, no matter how it came to exist (manual DB
  // edits, a future bug elsewhere, leftover data from before this check
  // existed). Calling the redeem API is only ever permitted once the exact
  // required set is verified.
  | { status: "count-mismatch"; codes: UnipinCode[]; expected: number };

function verifyLinkedSet(
  codes: UnipinCode[],
  neededByDenom: Map<string, number>,
  expectedTotal: number
): ClaimResult {
  if (codes.length !== expectedTotal) {
    return { status: "count-mismatch", codes, expected: expectedTotal };
  }
  const actualByDenom = tally(codes.map((c) => c.denom));
  for (const [denom, needed] of neededByDenom) {
    if ((actualByDenom.get(denom) ?? 0) !== needed) {
      return { status: "count-mismatch", codes, expected: expectedTotal };
    }
  }
  return { status: "already-claimed", codes };
}

// Atomically claims exactly the codes an order's denom recipe requires
// (e.g. "4,4,5" -> two denom-4 codes + one denom-5 code) from LOCAL unused
// stock only — this never purchases or tops up stock via any external API.
// If local stock can't fully cover every required denom, nothing is claimed
// and it reports "insufficient" — never a partial claim. Safe to call
// multiple times for the same order: once codes are linked, every later call
// re-verifies them against the recipe and returns them as "already-claimed"
// (or "count-mismatch" if something's actually wrong) without touching stock
// again.
export async function claimUnipinCodes(orderId: string): Promise<ClaimResult> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { rechargeOption: true },
  });

  const tokens = parseDenomRecipe(order.rechargeOption.denom);
  if (tokens.length === 0) return { status: "not-applicable" };

  const neededByDenom = tally(tokens);
  const expectedTotal = tokens.length;

  const alreadyLinked = await prisma.unipinCode.findMany({ where: { usedForOrderId: order.id } });
  if (alreadyLinked.length > 0) return verifyLinkedSet(alreadyLinked, neededByDenom, expectedTotal);

  // Real row-level locking (SELECT ... FOR UPDATE) so two orders can never
  // end up claiming the same code. A single bounded retry absorbs the rare
  // case where two orders racing for the same denom pool right at its
  // capacity boundary both come up short on their first pre-lock candidate
  // window — that only ever produces an extra "insufficient" outcome, never
  // a double-allocation or partial commit.
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Lock Order — serializes any concurrent/retried call for this exact
        // order, on top of the caller's own optimistic status/job claim.
        await tx.$queryRawUnsafe('SELECT id FROM `Order` WHERE id = ? FOR UPDATE', order.id);

        const stillLinked = await tx.unipinCode.findMany({ where: { usedForOrderId: order.id } });
        if (stillLinked.length > 0) return verifyLinkedSet(stillLinked, neededByDenom, expectedTotal);

        const claimedIds: string[] = [];
        for (const [denom, needed] of neededByDenom) {
          // Lock required UniPin rows + select unused codes in one locking
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

        // Mark used + assign to order immediately, inside the same
        // transaction that holds the row locks — never wait for the redeem
        // API call's success/failure to do this, since another order could
        // otherwise grab the same code in the meantime.
        await tx.unipinCode.updateMany({
          where: { id: { in: claimedIds }, status: "UNUSED" }, // defensive filter on top of the already-locked/verified rows
          data: { status: "USED", usedAt: new Date(), usedForOrderId: order.id },
        });

        const codes = await tx.unipinCode.findMany({ where: { id: { in: claimedIds } } });
        if (codes.length !== expectedTotal) {
          // Should be unreachable given the loop above always claims exactly
          // `expectedTotal` ids — but if it somehow isn't, fail loudly and
          // roll back rather than silently handing back a wrong-sized set.
          throw new Error(
            `claimUnipinCodes invariant violated for order ${order.id}: claimed ${codes.length}, expected ${expectedTotal}`
          );
        }
        return { status: "claimed" as const, codes };
      });
    } catch (error) {
      if (!(error instanceof InsufficientStockError)) throw error;
      // fall through to retry (or exit the loop after the last attempt)
    }
  }

  return { status: "insufficient" };
}
