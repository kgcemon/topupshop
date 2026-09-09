import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminOrderList } from "@/components/admin-order-list";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_FILTERS = [
  "AUTO_FAILED",
  "ALL",
  "PENDING",
  "APPROVED",
  "RUNNING",
  "DELIVERED",
  "REJECTED",
  "CANCELLED",
] as const;
const PAGE_SIZE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await auth();
  // Deleting orders and paying refunds out are both ADMIN-only; managers get
  // the rest of the order tooling.
  const isAdmin = session?.user?.role === "ADMIN";

  const { status, q, page } = await searchParams;
  const filter = STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number])
    ? (status as (typeof STATUS_FILTERS)[number])
    : "ALL";
  const query = (q ?? "").trim();
  const currentPage = Math.max(1, Number(page) || 1);

  const numericQuery = query.replace(/^#/, "");
  const isNumeric = /^\d+$/.test(numericQuery);

  const searchWhere: Prisma.OrderWhereInput = query
    ? {
        OR: [
          ...(isNumeric ? [{ orderSerial: Number(numericQuery) }] : []),
          { transactionId: { contains: query } },
        ],
      }
    : {};

  const filterWhere: Prisma.OrderWhereInput = {
    ...(filter === "ALL" ? {} : { status: filter }),
    ...searchWhere,
  };

  const [orders, matchingCount, statusCounts] = await Promise.all([
    prisma.order.findMany({
      where: filterWhere,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        product: true,
        rechargeOption: true,
        user: true,
        reviewedBy: true,
        redeemedUnipinCodes: { orderBy: { usedAt: "asc" } },
        apiCallLogs: { orderBy: { createdAt: "desc" }, include: { apiSetting: { select: { name: true } } } },
      },
    }),
    prisma.order.count({ where: filterWhere }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const totalCount = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const countByStatus: Record<string, number> = { ALL: totalCount };
  for (const row of statusCounts) countByStatus[row.status] = row._count._all;

  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));

  function pageHref(p: number) {
    const params = new URLSearchParams({ status: filter });
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    return `/admin/orders?${params.toString()}`;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
      <h1 className="mb-3 text-lg font-bold">Orders</h1>

      <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {STATUS_FILTERS.map((s) => {
            const isAutoFailed = s === "AUTO_FAILED";
            const hasAutoFailed = isAutoFailed && (countByStatus[s] ?? 0) > 0;
            return (
              <Link
                key={s}
                href={`/admin/orders?status=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                scroll={false}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  filter === s
                    ? hasAutoFailed
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-secondary-900 text-white shadow-sm"
                    : hasAutoFailed
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    filter === s ? "bg-white/20" : hasAutoFailed ? "bg-white text-red-700" : "bg-white text-gray-500"
                  }`}
                >
                  {countByStatus[s] ?? 0}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <form className="mb-4">
        <input type="hidden" name="status" value={filter} />
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="অর্ডার নাম্বার (যেমন #12) বা ট্রানজেকশন আইডি দিয়ে খুঁজুন..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-sm"
        />
      </form>

      <AdminOrderList
        key={`${filter}:${query}:${currentPage}`}
        orders={orders}
        filter={filter}
        query={query}
        canDelete={isAdmin}
        canRefund={isAdmin}
      />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs">
          <p className="text-gray-500">
            Page {currentPage} / {totalPages} ({matchingCount} orders)
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
  );
}
