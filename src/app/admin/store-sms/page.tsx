import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  togglePaymentSmsStatusAction,
  togglePaymentSmsActiveAction,
  deletePaymentSmsAction,
} from "@/lib/actions/payment-sms-actions";

const METHOD_LABELS: Record<string, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};

const STATUS_FILTERS = ["ALL", "UNUSED", "USED"] as const;
const PAGE_SIZE = 20;
const METHODS = ["BKASH", "NAGAD", "ROCKET"] as const;

export default async function AdminStoreSmsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { q, page, status } = await searchParams;
  const query = (q ?? "").trim();
  const currentPage = Math.max(1, Number(page) || 1);
  const filter = STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number])
    ? (status as (typeof STATUS_FILTERS)[number])
    : "ALL";

  const where: Prisma.PaymentSmsWhereInput = {
    ...(filter === "ALL" ? {} : { status: filter }),
    ...(query ? { OR: [{ paymentNumber: { contains: query } }, { trxId: { contains: query } }] } : {}),
  };

  const [logs, matchingCount, statusCounts, latestBalances] = await Promise.all([
    prisma.paymentSms.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        usedForOrder: { select: { orderSerial: true } },
        usedForWalletTransaction: { select: { id: true, amount: true } },
      },
    }),
    prisma.paymentSms.count({ where }),
    prisma.paymentSms.groupBy({ by: ["status"], _count: { _all: true } }),
    // Most recent SMS per method that actually reported a balance — this is
    // the admin's live bKash/Nagad/Rocket account balance, straight from the
    // last forwarded SMS, so they don't have to open each app to check it.
    Promise.all(
      METHODS.map((method) =>
        prisma.paymentSms.findFirst({
          where: { method, balance: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { balance: true, createdAt: true },
        })
      )
    ),
  ]);

  const totalCount = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const countByStatus: Record<string, number> = { ALL: totalCount };
  for (const row of statusCounts) countByStatus[row.status] = row._count._all;

  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams({ status: filter });
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    return `/admin/store-sms?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {METHODS.map((method, i) => {
          const latest = latestBalances[i];
          return (
            <div key={method} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
              <p className="text-xs font-semibold text-gray-500">{METHOD_LABELS[method]} ব্যালেন্স</p>
              {latest ? (
                <>
                  <p className="mt-1 text-xl font-bold">৳{latest.balance!.toString()}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {latest.createdAt.toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-400">কোনো ডাটা নেই</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-3 text-lg font-bold">Store SMS ({matchingCount})</h1>

        <div className="mb-4 flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={`/admin/store-sms?status=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              scroll={false}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filter === s ? "bg-secondary-900 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  filter === s ? "bg-white/20" : "bg-white text-gray-500"
                }`}
              >
                {countByStatus[s] ?? 0}
              </span>
            </Link>
          ))}
        </div>

        <form className="mb-4">
          <input type="hidden" name="status" value={filter} />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="নাম্বার বা ট্রানজেকশন আইডি দিয়ে খুঁজুন..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-sm"
          />
        </form>

        {logs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            কোনো Payment SMS পাওয়া যায়নি।
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2 pr-3 font-semibold">Amount</th>
                  <th className="py-2 pr-3 font-semibold">Sender</th>
                  <th className="py-2 pr-3 font-semibold">Sender Number</th>
                  <th className="py-2 pr-3 font-semibold">Trx ID</th>
                  <th className="py-2 pr-3 font-semibold">Balance</th>
                  <th className="py-2 pr-3 font-semibold">Used In</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Verify</th>
                  <th className="py-2 pr-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 font-bold whitespace-nowrap">৳{log.amount.toString()}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                        {METHOD_LABELS[log.method] ?? log.method}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{log.paymentNumber}</td>
                    <td className="py-2 pr-3 whitespace-nowrap font-mono">{log.trxId}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {log.balance ? `৳${log.balance.toString()}` : "—"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {log.usedForOrder ? (
                        <Link
                          href={`/admin/orders?status=ALL&q=${log.usedForOrder.orderSerial}`}
                          className="font-bold text-primary-600 hover:underline"
                        >
                          Order #{log.usedForOrder.orderSerial}
                        </Link>
                      ) : log.usedForWalletTransaction ? (
                        <Link href="/admin/wallet-requests" className="font-bold text-primary-600 hover:underline">
                          Wallet Deposit
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <form action={togglePaymentSmsStatusAction}>
                        <input type="hidden" name="id" value={log.id} />
                        <input type="hidden" name="status" value={log.status} />
                        <button
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            log.status === "USED" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"
                          }`}
                        >
                          {log.status === "USED" ? "Used" : "Unused"}
                        </button>
                      </form>
                    </td>
                    <td className="py-2 pr-3">
                      <form action={togglePaymentSmsActiveAction}>
                        <input type="hidden" name="id" value={log.id} />
                        <input type="hidden" name="isActive" value={String(log.isActive)} />
                        <button
                          title={log.isActive ? "Disable" : "Enable — re-allow auto-matching"}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            log.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                          }`}
                        >
                          {log.isActive ? "Verified" : "Mismatch"}
                        </button>
                      </form>
                    </td>
                    <td className="py-2 pr-3">
                      <form action={deletePaymentSmsAction}>
                        <input type="hidden" name="id" value={log.id} />
                        <button className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs">
            <p className="text-gray-500">
              Page {currentPage} / {totalPages} ({matchingCount} SMS)
            </p>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  scroll={false}
                  className="rounded-md border border-gray-300 px-3 py-1.5 font-bold hover:bg-gray-50"
                >
                  Prev
                </Link>
              ) : (
                <span className="rounded-md border border-gray-200 px-3 py-1.5 font-bold text-gray-300">Prev</span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  scroll={false}
                  className="rounded-md border border-gray-300 px-3 py-1.5 font-bold hover:bg-gray-50"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-md border border-gray-200 px-3 py-1.5 font-bold text-gray-300">Next</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
