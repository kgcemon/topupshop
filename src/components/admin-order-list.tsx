"use client";

import { useEffect, useRef, useState } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { formatTaka, formatOrderNumber, formatDhakaDateTime } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/copy-button";
import {
  updateOrderStatusAction,
  deleteOrderAction,
  deleteOrdersAction,
  refundOrderAction,
} from "@/lib/actions/admin-actions";

export type AdminOrderListItem = Prisma.OrderGetPayload<{
  include: {
    product: true;
    rechargeOption: true;
    user: true;
    reviewedBy: true;
    redeemedUnipinCodes: true;
    apiCallLogs: { include: { apiSetting: { select: { name: true } } } };
  };
}>;

function fmtDate(d: Date) {
  return formatDhakaDateTime(d, { dateStyle: "medium", timeStyle: "short" });
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3.5 w-3.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export function AdminOrderList({
  orders,
  filter,
  query,
  canDelete,
  canRefund,
}: {
  orders: AdminOrderListItem[];
  filter: string;
  query: string;
  canDelete: boolean;
  canRefund: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const someSelected = selected.size > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  if (orders.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
        কোনো অর্ডার নেই।
      </p>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))));
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50/95 px-3 py-2 text-xs backdrop-blur">
        <label className="flex items-center gap-2 font-bold text-gray-600">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300"
          />
          সব সিলেক্ট করুন
        </label>
        {canDelete && selected.size > 0 && (
          <form
            action={deleteOrdersAction}
            onSubmit={(e) => {
              if (!confirm(`${selected.size}টি অর্ডার স্থায়ীভাবে ডিলিট করবেন? এই কাজটি ফিরিয়ে নেওয়া যাবে না।`)) {
                e.preventDefault();
              }
            }}
            className="flex items-center gap-2"
          >
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="orderIds" value={id} />
            ))}
            <input type="hidden" name="redirectStatus" value={filter} />
            <input type="hidden" name="redirectQuery" value={query} />
            <span className="font-bold text-gray-500">{selected.size}টি সিলেক্টেড</span>
            <button
              type="submit"
              className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              <TrashIcon />
              ডিলিট
            </button>
          </form>
        )}
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            filter={filter}
            query={query}
            selected={selected.has(order.id)}
            onToggleSelect={() => toggle(order.id)}
            canDelete={canDelete}
            canRefund={canRefund}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  filter,
  query,
  selected,
  onToggleSelect,
  canDelete,
  canRefund,
}: {
  order: AdminOrderListItem;
  filter: string;
  query: string;
  selected: boolean;
  onToggleSelect: () => void;
  canDelete: boolean;
  canRefund: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Mirrors REFUNDABLE_STATUSES in admin-actions: the button only appears once
  // the order is actually undone, and never a second time.
  const refundable =
    canRefund &&
    !order.refundedAt &&
    !!order.userId &&
    (order.status === "REJECTED" || order.status === "CANCELLED" || order.status === "AUTO_FAILED");

  return (
    <div
      className={`rounded-lg border p-3 text-sm sm:p-4 ${
        selected ? "border-primary-400 bg-primary-50/50" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select order ${formatOrderNumber(order.orderSerial)}`}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
        />

        <div className="min-w-0 flex-1">
          {/* Mobile compact summary: TrxID, Player ID, Status only — full details behind the toggle below. */}
          <div className="sm:hidden">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-mono text-[11px] font-bold text-gray-500">
                {formatOrderNumber(order.orderSerial)}
              </p>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="mt-1.5">
              <p className="text-[10px] font-bold tracking-wide text-gray-400 uppercase">Player ID</p>
              <p className="truncate font-mono text-sm font-bold text-gray-900">{order.playerId}</p>
            </div>

            <div className="mt-1.5">
              <p className="text-[10px] font-bold tracking-wide text-gray-400 uppercase">Trx ID</p>
              <p className="truncate font-mono text-sm font-bold text-gray-900">
                {order.transactionId || "—"}
              </p>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-bold text-primary-600"
              >
                {open ? "বিস্তারিত লুকান" : "বিস্তারিত দেখুন"}
                <ChevronIcon open={open} />
              </button>

              {canDelete && (
                <form
                  action={deleteOrderAction}
                  onSubmit={(e) => {
                    if (!confirm(`অর্ডার ${formatOrderNumber(order.orderSerial)} স্থায়ীভাবে ডিলিট করবেন?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="redirectStatus" value={filter} />
                  <input type="hidden" name="redirectQuery" value={query} />
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600"
                  >
                    <TrashIcon />
                    ডিলিট
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Full details — always visible on desktop, toggled on mobile. */}
          <div className={`${open ? "mt-3 block" : "hidden"} sm:mt-0 sm:block`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="hidden truncate font-mono text-[11px] font-bold text-gray-500 sm:block">
                  {formatOrderNumber(order.orderSerial)}
                </p>
                <p className="font-bold leading-snug">
                  {order.product.name} — {order.rechargeOption.label}
                </p>
                <p className="text-[11px] text-gray-500">{fmtDate(order.createdAt)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-extrabold text-secondary-900">{formatTaka(order.amount)} TK</p>
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
                  <span className="hidden sm:inline-block">
                    <OrderStatusBadge status={order.status} />
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-primary-100 bg-primary-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wide text-primary-700 uppercase">Player ID</p>
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
                  `${order.user.name} · ${order.user.email}${order.user.phone ? ` · ${order.user.phone}` : ""}`
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
                            <p className="truncate font-mono text-sm font-bold text-gray-900">{code.code}</p>
                            <p className="text-[11px] text-gray-600">
                              Denom {code.denom} ·{" "}
                              <span
                                className={
                                  code.redeemedAt ? "font-semibold text-green-700" : "font-semibold text-orange-700"
                                }
                              >
                                {code.redeemedAt ? "API Redeemed ✓" : "API redeem বাকি"}
                              </span>
                              {code.redeemedAt ? ` · ${fmtDate(code.redeemedAt)}` : ""}
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
                        <span className="text-gray-500">{fmtDate(log.createdAt)}</span>
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
                    {order.reviewedAt ? ` · ${fmtDate(order.reviewedAt)}` : ""}
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
                <option value="AUTO_FAILED">AUTO_FAILED</option>
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

            {order.refundedAt && (
              <p className="mt-2 rounded-md bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
                ৳{formatTaka(order.refundedAmount ?? order.amount)} ওয়ালেটে রিফান্ড হয়েছে ·{" "}
                {fmtDate(order.refundedAt)}
              </p>
            )}

            {refundable && (
              <form
                action={refundOrderAction}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `অর্ডার ${formatOrderNumber(order.orderSerial)} এর ৳${formatTaka(order.amount)} ইউজারের ওয়ালেটে ফেরত দেবেন? এটি একবারই করা যাবে।`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
                className="mt-2"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="redirectStatus" value={filter} />
                <input type="hidden" name="redirectQuery" value={query} />
                <button
                  type="submit"
                  className="w-full rounded-md border border-green-300 px-3 py-1.5 text-xs font-bold text-green-700 hover:bg-green-50 sm:w-auto"
                >
                  ৳{formatTaka(order.amount)} ওয়ালেটে রিফান্ড করুন
                </button>
              </form>
            )}

            {canDelete && (
              <form
                action={deleteOrderAction}
                onSubmit={(e) => {
                  if (!confirm(`অর্ডার ${formatOrderNumber(order.orderSerial)} স্থায়ীভাবে ডিলিট করবেন?`)) {
                    e.preventDefault();
                  }
                }}
                className="mt-2 hidden justify-end sm:flex"
              >
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="redirectStatus" value={filter} />
                <input type="hidden" name="redirectQuery" value={query} />
                <button
                  type="submit"
                  className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <TrashIcon />
                  অর্ডার ডিলিট করুন
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
