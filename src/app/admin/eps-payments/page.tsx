import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { formatTaka, formatDhakaDateTime, formatOrderNumber } from "@/lib/utils";
import { adminRecheckEpsPaymentAction } from "@/lib/actions/eps-actions";

const STATUSES = ["ALL", "PENDING", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED"] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Exclude<StatusFilter, "ALL">, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

export default async function AdminEpsPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status: rawStatus, q } = await searchParams;
  const status: StatusFilter = STATUSES.includes(rawStatus as StatusFilter) ? (rawStatus as StatusFilter) : "ALL";
  const query = (q ?? "").trim().slice(0, 100);

  const where: Prisma.EpsPaymentWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(query
      ? {
          OR: [
            { merchantTransactionId: { contains: query } },
            { epsTransactionId: { contains: query } },
            { ref: query },
            { playerId: { contains: query } },
            { guestPhone: { contains: query } },
            { user: { email: { contains: query } } },
            ...(Number.isInteger(Number(query.replace("#", ""))) ? [{ order: { orderSerial: Number(query.replace("#", "")) } }] : []),
          ],
        }
      : {}),
  };

  const [payments, counts] = await Promise.all([
    prisma.epsPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        order: { select: { orderSerial: true, status: true } },
      },
    }),
    prisma.epsPayment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h1 className="mb-1 text-lg font-bold">EPS Payments</h1>
      <p className="mb-4 text-xs text-gray-500">
        প্রতিটি অটো পেমেন্ট সেশন। সিস্টেম প্রতি মিনিটে নিজে থেকেই অসম্পূর্ণ পেমেন্টগুলো EPS এ যাচাই করে — সফল হলে অর্ডার/ওয়ালেট
        স্বয়ংক্রিয়ভাবে তৈরি হয়। কোনো গ্রাহক টাকা কাটার কথা বললে এখানে খুঁজে <span className="font-semibold">Check status</span> চাপুন।
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/eps-payments?status=${s}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              status === s ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-200 hover:border-primary-500"
            }`}
          >
            {s}
            {s !== "ALL" && <span className="ml-1 text-gray-400">{countOf(s)}</span>}
          </Link>
        ))}
      </div>

      <form className="mb-4">
        <input type="hidden" name="status" value={status} />
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Payment ID, EPS TrxID, অর্ডার #, ইমেইল, প্লেয়ার আইডি..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-md"
        />
      </form>

      <div className="space-y-3">
        {payments.length === 0 && <p className="text-sm text-gray-500">কোনো পেমেন্ট পাওয়া যায়নি।</p>}
        {payments.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  <span>৳{formatTaka(p.paidAmount ?? p.amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                    {p.purpose === "ORDER" ? "অর্ডার" : "ওয়ালেট ডিপোজিট"}
                  </span>
                  {p.financialEntity && <span className="text-xs font-semibold text-gray-500">{p.financialEntity}</span>}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {p.user ? `${p.user.name ?? ""} (${p.user.email})` : `গেস্ট: ${p.guestName ?? "-"} ${p.guestPhone ?? ""}`}
                  {p.playerId && <> · Player: {p.playerId}</>}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-gray-500">
                  MTID {p.merchantTransactionId}
                  {p.epsTransactionId && <> · EPS {p.epsTransactionId}</>}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {formatDhakaDateTime(p.createdAt)}
                  {p.lastCheckedAt && <> · শেষ যাচাই {formatDhakaDateTime(p.lastCheckedAt)} ({p.checkCount} বার)</>}
                  {p.settledAt && <> · সেটেল {formatDhakaDateTime(p.settledAt)}</>}
                </p>
                {p.lastError && <p className="mt-1 break-words text-xs text-red-600">{p.lastError}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {p.order && (
                  <Link
                    href={`/admin/orders?status=ALL&q=${p.order.orderSerial}`}
                    className="text-xs font-bold text-primary-600 underline"
                  >
                    অর্ডার {formatOrderNumber(p.order.orderSerial)} ({p.order.status})
                  </Link>
                )}
                {p.walletTransactionId && <span className="text-xs font-semibold text-green-700">ওয়ালেটে যোগ হয়েছে</span>}
                {p.status !== "SUCCESS" && (
                  <form action={adminRecheckEpsPaymentAction}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <button className="rounded-md bg-primary-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-600">
                      Check status
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
