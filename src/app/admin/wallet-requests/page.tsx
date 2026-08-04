import { prisma } from "@/lib/prisma";
import { formatTaka, formatDhakaDateTime } from "@/lib/utils";
import { WalletStatusBadge } from "@/components/status-badge";
import { updateWalletTransactionAction } from "@/lib/actions/admin-actions";

export default async function AdminWalletRequestsPage() {
  const transactions = await prisma.walletTransaction.findMany({
    where: { type: "DEPOSIT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h1 className="mb-4 text-lg font-bold">Wallet Deposit Requests</h1>
      <div className="space-y-3">
        {transactions.length === 0 && <p className="text-sm text-gray-500">কোনো রিকোয়েস্ট নেই।</p>}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4 text-sm">
            <div>
              <p className="font-bold">
                {tx.user.name} ({tx.user.email})
              </p>
              <p className="text-xs text-gray-500">
                {tx.method} · Trx: {tx.transactionId} ·{" "}
                {formatDhakaDateTime(tx.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold">{formatTaka(tx.amount)} TK</span>
              <WalletStatusBadge status={tx.status} />
              {tx.status === "PENDING" && (
                <div className="flex gap-2">
                  <form action={updateWalletTransactionAction}>
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <input type="hidden" name="status" value="APPROVED" />
                    <button className="rounded-md bg-primary-500 px-3 py-1 text-xs font-bold text-white hover:bg-primary-600">
                      Approve
                    </button>
                  </form>
                  <form action={updateWalletTransactionAction}>
                    <input type="hidden" name="transactionId" value={tx.id} />
                    <input type="hidden" name="status" value="REJECTED" />
                    <button className="rounded-md bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600">
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
