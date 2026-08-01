import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/data";
import { formatTaka } from "@/lib/utils";
import { DepositForm } from "@/components/deposit-form";
import { WalletStatusBadge } from "@/components/status-badge";

export default async function DepositPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [settings, transactions] = await Promise.all([
    getSiteSettings(),
    prisma.walletTransaction.findMany({
      where: { userId, type: "DEPOSIT" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-bold">Deposit Request</h1>
        <DepositForm
          numbers={{
            bkashNumber: settings.bkashNumber,
            nagadNumber: settings.nagadNumber,
            rocketNumber: settings.rocketNumber,
          }}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Deposit History</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">কোনো ডিপোজিট রিকোয়েস্ট নেই।</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {tx.method} · {tx.transactionId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.createdAt).toLocaleString("bn-BD")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatTaka(tx.amount)} TK</span>
                  <WalletStatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
