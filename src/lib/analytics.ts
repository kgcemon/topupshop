import { prisma } from "@/lib/prisma";
import { getDhakaDayRange } from "@/lib/utils";

export type AnalyticsRange = "weekly" | "monthly" | "all";

export type TrendPoint = { label: string; revenue: number; orders: number; newUsers: number };
export type StatusSlice = { status: string; count: number };
export type ProductSlice = { name: string; revenue: number; orders: number };
export type PaymentSlice = { method: string; amount: number; count: number };
export type AdviceItem = { level: "critical" | "warning" | "good"; text: string };

export type AnalyticsData = {
  range: AnalyticsRange;
  periodLabel: string;
  trendGranularity: "day" | "month";
  stats: {
    totalOrders: number;
    totalOrdersDelta: number | null;
    deliveredRevenue: number;
    deliveredRevenueDelta: number | null;
    avgOrderValue: number;
    avgOrderValueDelta: number | null;
    newUsers: number;
    newUsersDelta: number | null;
  };
  liveBacklog: { pendingOrders: number; pendingWalletRequests: number };
  trend: TrendPoint[];
  statusBreakdown: StatusSlice[];
  topProducts: ProductSlice[];
  paymentBreakdown: PaymentSlice[];
  advice: AdviceItem[];
};

// Dhaka-local calendar-month boundaries, `monthsAgo` months back (0 = current month).
// Mirrors getDhakaDayRange's approach so month buckets line up with the same
// Asia/Dhaka calendar the rest of the admin panel already reports in.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
function getDhakaMonthRange(monthsAgo: number): { start: Date; end: Date } {
  const shifted = new Date(Date.now() + DHAKA_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() - monthsAgo;
  const start = new Date(Date.UTC(year, month, 1) - DHAKA_OFFSET_MS);
  const end = new Date(Date.UTC(year, month + 1, 1) - DHAKA_OFFSET_MS);
  return { start, end };
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const BN_MONTHS = ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];
const BN_WEEKDAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

export async function getAnalyticsData(range: AnalyticsRange): Promise<AnalyticsData> {
  const bucketCount = range === "weekly" ? 7 : range === "monthly" ? 30 : 12;
  const granularity: "day" | "month" = range === "all" ? "month" : "day";

  const windowStart =
    granularity === "day" ? getDhakaDayRange(bucketCount - 1).start : getDhakaMonthRange(bucketCount - 1).start;
  const windowEnd = granularity === "day" ? getDhakaDayRange(0).end : getDhakaMonthRange(0).end;

  // "All" reports true since-launch totals (no lower bound) — only the trend
  // chart below is capped to the last 12 months for readability.
  const currentWhere = range === "all" ? {} : { createdAt: { gte: windowStart, lt: windowEnd } };

  // "All" has no meaningful previous-period comparison (there's nothing before
  // the site's own history to compare against), so deltas are simply omitted.
  const previousStart =
    range === "weekly"
      ? getDhakaDayRange(13).start
      : range === "monthly"
        ? getDhakaDayRange(59).start
        : null;
  const previousEnd = previousStart ? windowStart : null;

  const [currentOrders, previousAgg, previousNewUsers, liveBacklog] = await Promise.all([
    prisma.order.findMany({
      where: currentWhere,
      select: {
        amount: true,
        status: true,
        paymentMethod: true,
        createdAt: true,
        productId: true,
        product: { select: { name: true } },
      },
    }),
    previousStart
      ? prisma.order.aggregate({
          where: { createdAt: { gte: previousStart, lt: previousEnd! }, status: "DELIVERED" },
          _sum: { amount: true },
          _count: true,
        })
      : Promise.resolve(null),
    previousStart
      ? prisma.user.count({ where: { createdAt: { gte: previousStart, lt: previousEnd! } } })
      : Promise.resolve(null),
    Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.walletTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    ]),
  ]);

  const currentUsers = await prisma.user.findMany({
    where: currentWhere,
    select: { createdAt: true },
  });

  // Previous-period order count/total needed for the "total orders" delta —
  // fetched separately from the DELIVERED-only aggregate above.
  const previousOrderCount = previousStart
    ? await prisma.order.count({ where: { createdAt: { gte: previousStart, lt: previousEnd! } } })
    : null;

  const deliveredOrders = currentOrders.filter((o) => o.status === "DELIVERED");
  const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + o.amount, 0);
  const avgOrderValue = deliveredOrders.length > 0 ? Math.round(deliveredRevenue / deliveredOrders.length) : 0;

  const previousDeliveredRevenue = previousAgg?._sum.amount ?? 0;
  const previousDeliveredCount = previousAgg?._count ?? 0;
  const previousAvgOrderValue =
    previousDeliveredCount > 0 ? Math.round(previousDeliveredRevenue / previousDeliveredCount) : 0;

  // Bucket orders/users into `bucketCount` slots of the chosen granularity.
  const buckets: TrendPoint[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const { start, end } = granularity === "day" ? getDhakaDayRange(i) : getDhakaMonthRange(i);
    const label =
      granularity === "day"
        ? bucketCount <= 7
          ? BN_WEEKDAYS[new Date(start.getTime() + DHAKA_OFFSET_MS).getUTCDay()]
          : `${new Date(start.getTime() + DHAKA_OFFSET_MS).getUTCDate()}`
        : `${BN_MONTHS[new Date(start.getTime() + DHAKA_OFFSET_MS).getUTCMonth()]}`;

    const ordersInBucket = currentOrders.filter((o) => o.createdAt >= start && o.createdAt < end);
    const usersInBucket = currentUsers.filter((u) => u.createdAt >= start && u.createdAt < end);
    buckets.push({
      label,
      revenue: ordersInBucket.filter((o) => o.status === "DELIVERED").reduce((s, o) => s + o.amount, 0),
      orders: ordersInBucket.length,
      newUsers: usersInBucket.length,
    });
  }

  const statusCounts = new Map<string, number>();
  for (const o of currentOrders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  const statusBreakdown: StatusSlice[] = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const productAgg = new Map<number, { name: string; revenue: number; orders: number }>();
  for (const o of currentOrders) {
    const entry = productAgg.get(o.productId) ?? { name: o.product.name, revenue: 0, orders: 0 };
    entry.revenue += o.status === "DELIVERED" ? o.amount : 0;
    entry.orders += 1;
    productAgg.set(o.productId, entry);
  }
  const topProducts: ProductSlice[] = [...productAgg.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const paymentAgg = new Map<string, { amount: number; count: number }>();
  for (const o of currentOrders) {
    const entry = paymentAgg.get(o.paymentMethod) ?? { amount: 0, count: 0 };
    entry.amount += o.status === "DELIVERED" ? o.amount : 0;
    entry.count += 1;
    paymentAgg.set(o.paymentMethod, entry);
  }
  const paymentBreakdown: PaymentSlice[] = [...paymentAgg.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.count - a.count);

  const totalOrders = currentOrders.length;
  const rejectedOrCancelled = currentOrders.filter(
    (o) => o.status === "REJECTED" || o.status === "CANCELLED"
  ).length;
  const autoFailed = currentOrders.filter((o) => o.status === "AUTO_FAILED").length;
  const [pendingOrders, pendingWalletRequests] = liveBacklog;

  const advice: AdviceItem[] = [];
  const hasEnoughSample = totalOrders >= 5;

  if (hasEnoughSample && rejectedOrCancelled / totalOrders > 0.2) {
    advice.push({
      level: "critical",
      text: `বাতিল/প্রত্যাখ্যাত অর্ডারের হার বেশি (${Math.round(
        (rejectedOrCancelled / totalOrders) * 100
      )}%) — পেমেন্ট ভেরিফিকেশন প্রক্রিয়া ও স্টক পর্যাপ্ততা যাচাই করুন।`,
    });
  }
  if (autoFailed > 0) {
    advice.push({
      level: "critical",
      text: `${autoFailed}টি অর্ডার অটো-ফেইলড হয়েছে — Unipin/Shell API সেটিংস এবং স্টক পরীক্ষা করুন।`,
    });
  }
  if (pendingOrders > 10) {
    advice.push({
      level: "warning",
      text: `বর্তমানে ${pendingOrders}টি অর্ডার পেন্ডিং অবস্থায় আছে — দ্রুত রিভিউ করুন যাতে গ্রাহক দ্রুত ডেলিভারি পান।`,
    });
  }
  if (pendingWalletRequests > 5) {
    advice.push({
      level: "warning",
      text: `${pendingWalletRequests}টি ওয়ালেট ডিপোজিট রিকোয়েস্ট পেন্ডিং আছে — দ্রুত অনুমোদন দিন, নাহলে গ্রাহক অর্ডার করতে পারবেন না।`,
    });
  }
  const revenueDelta = pctDelta(deliveredRevenue, previousDeliveredRevenue);
  if (revenueDelta !== null && revenueDelta <= -20) {
    advice.push({
      level: "warning",
      text: `আগের সময়ের তুলনায় বিক্রয় ${Math.abs(revenueDelta)}% কমেছে — অফার/ডিসকাউন্ট বা মার্কেটিং বাড়ানোর কথা বিবেচনা করুন।`,
    });
  }
  if (advice.length === 0) {
    advice.push({ level: "good", text: "সবকিছু স্বাভাবিক অবস্থায় আছে — এই মুহূর্তে জরুরি কোনো সমস্যা পাওয়া যায়নি।" });
  }

  const periodLabel = range === "weekly" ? "গত ৭ দিন" : range === "monthly" ? "গত ৩০ দিন" : "শুরু থেকে সর্বমোট";

  return {
    range,
    periodLabel,
    trendGranularity: granularity,
    stats: {
      totalOrders,
      totalOrdersDelta: previousOrderCount !== null ? pctDelta(totalOrders, previousOrderCount) : null,
      deliveredRevenue,
      deliveredRevenueDelta: revenueDelta,
      avgOrderValue,
      avgOrderValueDelta:
        previousAgg !== null ? pctDelta(avgOrderValue, previousAvgOrderValue) : null,
      newUsers: currentUsers.length,
      newUsersDelta: previousNewUsers !== null ? pctDelta(currentUsers.length, previousNewUsers) : null,
    },
    liveBacklog: { pendingOrders, pendingWalletRequests },
    trend: buckets,
    statusBreakdown,
    topProducts,
    paymentBreakdown,
    advice,
  };
}
