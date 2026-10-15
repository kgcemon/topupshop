import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/data";
import { formatTaka, formatDhakaDateTime } from "@/lib/utils";
import { DepositForm } from "@/components/deposit-form";
import { WalletStatusBadge } from "@/components/status-badge";
import { getPaymentMethodConfig } from "@/lib/payment-methods";

const METHOD_COLORS: Record<string, string> = {
  BKASH: "#E2136E",
  NAGAD: "#F42534",
  ROCKET: "#8C3494",
  EPS: "#059669",
};

export default async function DepositPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [settings, transactions, paymentMethods] = await Promise.all([
    getSiteSettings(),
    prisma.walletTransaction.findMany({
      where: { userId, type: "DEPOSIT" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getPaymentMethodConfig(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h1 className="mb-4 text-lg font-bold">Deposit Request</h1>
        {settings.depositEnabled ? (
          <DepositForm
            numbers={{
              bkashNumber: settings.bkashNumber,
              nagadNumber: settings.nagadNumber,
              rocketNumber: settings.rocketNumber,
            }}
            icons={{
              bkashIcon: settings.bkashIcon,
              nagadIcon: settings.nagadIcon,
              rocketIcon: settings.rocketIcon,
            }}
            bkashMinAmount={settings.bkashMinAmount}
            bkashMinWarning={settings.bkashMinWarning}
            manualEnabled={paymentMethods.manual.enabled}
            manualTitle={paymentMethods.manual.title}
            eps={paymentMethods.eps}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
            <p className="text-sm font-semibold text-gray-700">ডিপোজিট আপাতত বন্ধ আছে</p>
            <p className="mt-1 text-xs text-gray-500">
              এখন নতুন কোনো টাকা যোগ করার রিকোয়েস্ট নেওয়া হচ্ছে না। ওয়ালেটে থাকা ব্যালেন্স দিয়ে
              আগের মতোই অর্ডার করতে পারবেন। সহায়তার জন্য সাপোর্টে যোগাযোগ করুন।
            </p>
          </div>
        )}
      </div>

      <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">Deposit History</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">কোনো ডিপোজিট রিকোয়েস্ট নেই।</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const icon =
                tx.method === "BKASH"
                  ? settings.bkashIcon
                  : tx.method === "NAGAD"
                    ? settings.nagadIcon
                    : tx.method === "ROCKET"
                      ? settings.rocketIcon
                      : settings.walletIcon;
              return (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    {icon ? (
                      <Image src={icon} alt={tx.method} width={20} height={20} unoptimized className="h-5 w-5 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: METHOD_COLORS[tx.method] ?? "#6B7280" }}
                      >
                        {tx.method.charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {tx.method === "EPS" ? paymentMethods.eps.title : tx.method} · {tx.transactionId}
                      </p>
                      <p className="text-xs text-gray-500">{formatDhakaDateTime(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="whitespace-nowrap font-bold">{formatTaka(tx.amount)} TK</span>
                    <WalletStatusBadge status={tx.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
