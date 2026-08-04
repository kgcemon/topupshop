import type { PaymentMethod, Prisma } from "@/generated/prisma/client";

// Atomically claims an UNUSED PaymentSms row matching this trxId/method,
// flipping it to USED so the same forwarded SMS can never back two different
// orders/deposits. Returns the claimed row, or null when no matching unused
// SMS exists — callers fall back to the normal manual-review PENDING flow in
// that case.
//
// `amount`, when passed, must equal the SMS's actual amount exactly (used by
// order checkout, where the price is fixed by the product and any mismatch
// should fall back to manual review rather than silently over/under-charging).
// Omit it (as wallet deposits do) to match on trxId+method alone and let the
// caller trust the SMS's real amount instead of whatever the customer typed —
// that value is just their (possibly wrong, possibly padded) claim.
export async function claimMatchingPaymentSms(
  tx: Prisma.TransactionClient,
  params: { method: PaymentMethod; trxId: string; amount?: number | string | Prisma.Decimal }
) {
  const candidate = await tx.paymentSms.findFirst({
    where: { trxId: params.trxId, method: params.method, status: "UNUSED", isActive: true },
  });
  if (!candidate) return null;
  if (params.amount !== undefined && Number(candidate.amount) !== Number(params.amount)) {
    return null;
  }

  const claimed = await tx.paymentSms.updateMany({
    where: { id: candidate.id, status: "UNUSED", isActive: true },
    data: { status: "USED" },
  });
  return claimed.count > 0 ? candidate : null;
}

// Looks up an UNUSED PaymentSms row by trxId/method without claiming it —
// used where the caller needs to inspect the SMS's actual amount (e.g.
// compare it against an order's price) before deciding whether claiming it
// is even the right move.
export async function findUnusedPaymentSms(
  tx: Prisma.TransactionClient,
  params: { method: PaymentMethod; trxId: string }
) {
  return tx.paymentSms.findFirst({
    where: { trxId: params.trxId, method: params.method, status: "UNUSED", isActive: true },
  });
}

// Atomically flips a specific PaymentSms row to USED, guarding against a
// concurrent claim of the same row. Returns whether this call won the claim.
export async function claimPaymentSmsById(tx: Prisma.TransactionClient, id: number) {
  const claimed = await tx.paymentSms.updateMany({
    where: { id, status: "UNUSED" },
    data: { status: "USED" },
  });
  return claimed.count > 0;
}
