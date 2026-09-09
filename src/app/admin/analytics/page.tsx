import Link from "next/link";
import { getAnalyticsData, type AnalyticsRange } from "@/lib/analytics";
import { formatTaka } from "@/lib/utils";
import { AnalyticsTrendChart } from "@/components/analytics-trend-chart";
import { AnalyticsBarList, type AnalyticsBarRow } from "@/components/analytics-bar-list";
import { AnalyticsAdvicePanel } from "@/components/analytics-advice-panel";
import { AnalyticsReportDownload } from "@/components/analytics-report-download";
import { OrderStatusBadge } from "@/components/status-badge";

const RANGE_TABS: { value: AnalyticsRange; label: string }[] = [
  { value: "weekly", label: "সাপ্তাহিক" },
  { value: "monthly", label: "মাসিক" },
  { value: "all", label: "সর্বমোট" },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#eab308",
  APPROVED: "#2563eb",
  RUNNING: "#9333ea",
  DELIVERED: "#16a34a",
  REJECTED: "#dc2626",
  CANCELLED: "#9ca3af",
  REFUNDED: "#d97706",
  AUTO_FAILED: "#e11d48",
};

const PAYMENT_COLORS: Record<string, string> = {
  WALLET: "#0f3460",
  BKASH: "#E2136E",
  NAGAD: "#F42534",
  ROCKET: "#8C3494",
};

const PAYMENT_LABELS: Record<string, string> = {
  WALLET: "ওয়ালেট",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
};

function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-gray-900">{value}</p>
      {delta !== null && (
        <p
          className={`mt-1 flex items-center gap-1 text-[11px] font-bold ${
            delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-400"
          }`}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}%
          <span className="font-medium text-gray-400">আগের সময়ের তুলনায়</span>
        </p>
      )}
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: AnalyticsRange =
    rawRange === "monthly" || rawRange === "all" ? rawRange : "weekly";

  const data = await getAnalyticsData(range);

  const statusRows: AnalyticsBarRow[] = data.statusBreakdown.map((s) => ({
    id: s.status,
    label: <OrderStatusBadge status={s.status} />,
    value: s.count,
    valueLabel: `${s.count}`,
    barColor: STATUS_COLORS[s.status] ?? "#9ca3af",
  }));

  const productRows: AnalyticsBarRow[] = data.topProducts.map((p, i) => ({
    id: `${p.name}-${i}`,
    label: <span className="font-semibold text-gray-700">{p.name}</span>,
    value: p.revenue,
    valueLabel: `৳ ${formatTaka(p.revenue)}`,
    barColor: "#10b323",
  }));

  const paymentRows: AnalyticsBarRow[] = data.paymentBreakdown.map((p) => ({
    id: p.method,
    label: (
      <span className="flex items-center gap-1.5 font-semibold text-gray-700">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: PAYMENT_COLORS[p.method] ?? "#9ca3af" }}
        />
        {PAYMENT_LABELS[p.method] ?? p.method} ({p.count})
      </span>
    ),
    value: p.amount,
    valueLabel: `৳ ${formatTaka(p.amount)}`,
    barColor: PAYMENT_COLORS[p.method] ?? "#9ca3af",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Analytics</h1>
        <AnalyticsReportDownload data={data} />
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/analytics?range=${tab.value}`}
            scroll={false}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              range === tab.value
                ? "bg-secondary-900 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </Link>
        ))}
        <span className="ml-1 self-center text-xs font-semibold text-gray-400">{data.periodLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="মোট অর্ডার" value={String(data.stats.totalOrders)} delta={data.stats.totalOrdersDelta} />
        <StatTile
          label="ডেলিভারড রেভিনিউ"
          value={`৳ ${formatTaka(data.stats.deliveredRevenue)}`}
          delta={data.stats.deliveredRevenueDelta}
        />
        <StatTile
          label="গড় অর্ডার ভ্যালু"
          value={`৳ ${formatTaka(data.stats.avgOrderValue)}`}
          delta={data.stats.avgOrderValueDelta}
        />
        <StatTile label="নতুন ইউজার" value={String(data.stats.newUsers)} delta={data.stats.newUsersDelta} />
      </div>

      <AnalyticsAdvicePanel advice={data.advice} />

      <div className="grid gap-3 lg:grid-cols-3">
        <AnalyticsTrendChart
          title="রেভিনিউ ট্রেন্ড"
          points={data.trend.map((p) => ({ label: p.label, value: p.revenue }))}
          color="#10b323"
          unit="currency"
        />
        <AnalyticsTrendChart
          title="অর্ডার ট্রেন্ড"
          points={data.trend.map((p) => ({ label: p.label, value: p.orders }))}
          color="#2563eb"
          unit="orders"
        />
        <AnalyticsTrendChart
          title="নতুন ইউজার ট্রেন্ড"
          points={data.trend.map((p) => ({ label: p.label, value: p.newUsers }))}
          color="#d97706"
          unit="people"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AnalyticsBarList title="অর্ডার স্ট্যাটাস ব্রেকডাউন" rows={statusRows} emptyText="এই সময়ে কোনো অর্ডার নেই।" />
        <AnalyticsBarList
          title="পেমেন্ট মেথড ব্রেকডাউন (ডেলিভারড)"
          rows={paymentRows}
          emptyText="এই সময়ে কোনো লেনদেন নেই।"
        />
      </div>

      <AnalyticsBarList
        title="শীর্ষ ৫ প্রোডাক্ট (রেভিনিউ অনুযায়ী)"
        rows={productRows}
        emptyText="এই সময়ে কোনো ডেলিভারড অর্ডার নেই।"
      />
    </div>
  );
}
