import type { PaymentMethod, Prisma, PrismaClient } from "@/generated/prisma/client";

type AnyClient = PrismaClient | Prisma.TransactionClient;

// Shared message for every "this trx id is already spent" path, so checkout
// and wallet deposit read identically to the customer no matter which side
// actually consumed it.
export const TRANSACTION_ID_IN_USE_MESSAGE = "এই ট্রানজেকশন আইডি ইতিমধ্যে ব্যবহার করা হয়েছে";

const USED_BY_ORDER_MESSAGE =
  "এই ট্রানজেকশন আইডি একটি অর্ডারে ব্যবহার করা হয়েছে, আবার ব্যবহার করা যাবে না";
const USED_BY_WALLET_MESSAGE =
  "এই ট্রানজেকশন আইডি ওয়ালেট রিকোয়েস্টে ব্যবহার করা হয়েছে, আবার ব্যবহার করা যাবে না";

// Is this gateway trx id still free to spend? Checks the TransactionIdUse
// ledger first (every claim made since this feature landed), then falls back
// to scanning Order/WalletTransaction directly so rows that predate the
// ledger — or that were written by some future code path that forgets to
// claim — still block a reuse.
//
// Advisory only: two concurrent submissions of the same id can both clear
// this. claimTransactionId() below is what actually decides the winner.
export async function checkTransactionIdAvailable(
  client: AnyClient,
  trxId: string
): Promise<{ available: true } | { available: false; message: string }> {
  const claim = await client.transactionIdUse.findUnique({ where: { trxId } });
  if (claim) {
    return { available: false, message: claim.orderId ? USED_BY_ORDER_MESSAGE : USED_BY_WALLET_MESSAGE };
  }

  const order = await client.order.findUnique({ where: { transactionId: trxId }, select: { id: true } });
  if (order) return { available: false, message: USED_BY_ORDER_MESSAGE };

  const wallet = await client.walletTransaction.findFirst({
    where: { transactionId: trxId },
    select: { id: true },
  });
  if (wallet) return { available: false, message: USED_BY_WALLET_MESSAGE };

  return { available: true };
}

// Records that `trxId` is now spent, by an order or by a wallet deposit.
// MUST be called inside the same transaction that creates the order/deposit:
// the unique index on trxId is the only thing that actually stops one gateway
// transaction from backing two different credits, and it can only do that if
// the claim commits (or rolls back) together with what it is paying for.
// Throws Prisma P2002 when the id was already spent — callers turn that into
// TRANSACTION_ID_IN_USE_MESSAGE.
export async function claimTransactionId(
  tx: Prisma.TransactionClient,
  params: { trxId: string; method: PaymentMethod; orderId?: string; walletTransactionId?: string }
) {
  return tx.transactionIdUse.create({
    data: {
      trxId: params.trxId,
      method: params.method,
      orderId: params.orderId ?? null,
      walletTransactionId: params.walletTransactionId ?? null,
    },
  });
}
