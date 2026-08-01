import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTaka, formatOrderNumber } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/copy-button";
import { updateOrderStatusAction } from "@/lib/actions/admin-actions";
import type { Prisma } from "@/generated/prisma/client";

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "RUNNING", "DELIVERED", "REJECTED", "CANCELLED"] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const filter = STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number])
    ? (status as (typeof STATUS_FILTERS)[number])
    : "ALL";
  const query = (q ?? "").trim();

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

  const [orders, statusCounts] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...(filter === "ALL" ? {} : { status: filter }),
        ...searchWhere,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        product: true,
        rechargeOption: true,
        user: true,
        reviewedBy: true,
        redeemedUnipinCodes: { orderBy: { usedAt: "asc" } },
        apiCallLogs: { orderBy: { createdAt: "desc" }, include: { apiSetting: { select: { name: true } } } },
      },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const totalCount = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const countByStatus: Record<string, number> = { ALL: totalCount };
  for (const row of statusCounts) countByStatus[row.status] = row._count._all;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
      <h1 className="mb-3 text-lg font-bold">Orders</h1>

      <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s}
              href={`/admin/orders?status=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              scroll={false}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                filter === s
                  ? "bg-secondary-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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

      <div className="space-y-3">
        {orders.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            কোনো অর্ডার নেই।
          </p>
        )}
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border border-gray-200 p-3 text-sm sm:p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] font-bold text-gray-500">
                  {formatOrderNumber(order.orderSerial)}
                </p>
                <p className="font-bold leading-snug">
                  {order.product.name} — {order.rechargeOption.label}
                </p>
                <p className="text-[11px] text-gray-500">
                  {new Date(order.createdAt).toLocaleString("bn-BD", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-extrabold text-secondary-900">
                  {formatTaka(order.amount)} TK
                </p>
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      order.rechargeOption.deliveryMethod === "UNIPIN"
                        ? "bg-blue-100 text-blue-700"
                        : order.rechargeOption.deliveryMethod === "SHELL"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {order.rechargeOption.deliveryMethod}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wide text-primary-700 uppercase">
                  Player ID
                </p>
                <p className="truncate font-mono text-sm font-bold text-gray-900">{order.playerId}</p>
                {order.playerName && (
                  <p className="truncate text-[11px] text-gray-600">{order.playerName}</p>
                )}
              </div>
              <CopyButton value={order.playerId} label="Copy ID" />
            </div>

            <div className="mb-2 grid grid-cols-1 gap-2 text-[11px] text-gray-600 sm:grid-cols-2">
              <p className="truncate">
                {order.user ? (
                  `${order.user.name} · ${order.user.email}`
                ) : (
                  <>
                    <span className="mr-1.5 inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                      GUEST
                    </span>
                    {order.guestName} · {order.guestPhone}
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span>
                  পেমেন্ট: <span className="font-semibold">{order.paymentMethod}</span>
                </span>
                {order.transactionId && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5">
                    <span className="font-mono">TrxID: {order.transactionId}</span>
                    <CopyButton value={order.transactionId} label="" />
                  </span>
                )}
              </div>
            </div>

            {order.rechargeOption.deliveryMethod === "UNIPIN" &&
              (() => {
              const recipe = (order.rechargeOption.denom ?? "")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              if (recipe.length === 0) return null;

              if (order.redeemedUnipinCodes.length > 0) {
                const claimComplete = order.redeemedUnipinCodes.length >= recipe.length;
                const allRedeemed = order.redeemedUnipinCodes.every((c) => c.redeemedAt);
                const complete = claimComplete && allRedeemed;
                return (
                  <div
                    className={`mb-2 space-y-1.5 rounded-md border px-3 py-2 ${
                      complete ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p
                        className={`text-[10px] font-bold tracking-wide uppercase ${
                          complete ? "text-green-700" : "text-orange-700"
                        }`}
                      >
                        Unipin কোড ({order.redeemedUnipinCodes.length}/{recipe.length}){" "}
                        {complete ? "✓" : "⚠"}
                      </p>
                      {!allRedeemed && claimComplete && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-orange-700">
                          কোড claim হয়েছে কিন্তু API redeem বাকি
                        </span>
                      )}
                    </div>
                    {order.redeemedUnipinCodes.map((code) => (
                      <div key={code.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-sm font-bold text-gray-900">
                            {code.code}
                          </p>
                          <p className="text-[11px] text-gray-600">
                            Denom {code.denom} ·{" "}
                            <span className={code.redeemedAt ? "font-semibold text-green-700" : "font-semibold text-orange-700"}>
                              {code.redeemedAt ? "API Redeemed ✓" : "API redeem বাকি"}
                            </span>
                            {code.redeemedAt
                              ? ` · ${new Date(code.redeemedAt).toLocaleString("bn-BD", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}`
                              : ""}
                          </p>
                        </div>
                        <CopyButton value={code.code} label="Copy" />
                      </div>
                    ))}
                  </div>
                );
              }

              if (order.status === "APPROVED") {
                return (
                  <div className="mb-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                    Approve করার সময় প্রয়োজনীয় সব denom-এ যথেষ্ট unused Unipin কোড ছিল না — Unipin ট্যাব থেকে
                    স্টক যোগ করে আবার Approve করুন।
                  </div>
                );
              }

              return null;
            })()}

            {order.rechargeOption.deliveryMethod === "SHELL" &&
              order.status === "APPROVED" &&
              !order.apiCallLogs.some((log) => log.deliveryMethod === "SHELL" && log.success) && (
                <div className="mb-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                  Shell API কল সফল হয়নি বা এখনো হয়নি — API Settings-এ Shell config চেক করে আবার Approve সাবমিট করে
                  রিট্রাই করুন।
                </div>
              )}

            {order.apiCallLogs.length > 0 && (
              <details className="mb-2 rounded-md border border-gray-200">
                <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-bold text-gray-600">
                  API Call Log ({order.apiCallLogs.length})
                </summary>
                <div className="space-y-2 border-t border-gray-100 p-3">
                  {order.apiCallLogs.map((log) => (
                    <div key={log.id} className="rounded-md bg-gray-50 p-2 text-[11px]">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            log.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {log.success ? "SUCCESS" : "FAILED"}
                        </span>
                        {log.deliveryMethod && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                            {log.deliveryMethod}
                          </span>
                        )}
                        {log.apiSetting && <span className="font-semibold">{log.apiSetting.name}</span>}
                        {log.denom && <span>Denom: {log.denom}</span>}
                        {log.statusCode !== null && <span>HTTP {log.statusCode}</span>}
                        <span className="text-gray-500">
                          {new Date(log.createdAt).toLocaleString("bn-BD", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      {log.errorMessage && (
                        <p className="mb-1 font-semibold text-red-700">Error: {log.errorMessage}</p>
                      )}
                      {log.requestBody && (
                        <pre className="mb-1 max-h-32 overflow-auto rounded bg-white p-1.5 font-mono text-[10px] whitespace-pre-wrap">
                          {log.requestBody}
                        </pre>
                      )}
                      {log.responseBody && (
                        <pre className="max-h-32 overflow-auto rounded bg-white p-1.5 font-mono text-[10px] whitespace-pre-wrap">
                          {log.responseBody}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {(order.adminNote || order.reviewedBy) && (
              <div className="mb-2 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                {order.reviewedBy && (
                  <p>
                    Reviewed by <span className="font-semibold">{order.reviewedBy.name}</span>
                    {order.reviewedAt
                      ? ` · ${new Date(order.reviewedAt).toLocaleString("bn-BD", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`
                      : ""}
                  </p>
                )}
                {order.adminNote && <p>Note: {order.adminNote}</p>}
              </div>
            )}

            <form
              action={updateOrderStatusAction}
              className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 sm:flex sm:flex-wrap sm:items-center"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="redirectStatus" value={filter} />
              <input type="hidden" name="redirectQuery" value={query} />
              <select
                name="status"
                defaultValue={order.status}
                className="col-span-2 rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:col-auto"
              >
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="RUNNING">RUNNING</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <input
                name="adminNote"
                defaultValue={order.adminNote ?? ""}
                placeholder="Admin note (optional)"
                className="col-span-2 rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:min-w-[160px] sm:flex-1"
              />
              <button
                type="submit"
                className="col-span-2 rounded-md bg-secondary-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 sm:col-auto"
              >
                Update
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
