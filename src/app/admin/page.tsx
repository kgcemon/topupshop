import { prisma } from "@/lib/prisma";
import { formatTaka, getDhakaDayRange } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const today = getDhakaDayRange(0);
  const yesterday = getDhakaDayRange(1);

  const [pendingOrders, pendingDeposits, totalUsers, deliveredAgg, todayAgg, yesterdayAgg] =
    await Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.walletTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
      prisma.user.count(),
      prisma.order.aggregate({
        where: { status: "DELIVERED" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: "DELIVERED", createdAt: { gte: today.start, lt: today.end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { status: "DELIVERED", createdAt: { gte: yesterday.start, lt: yesterday.end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

  const deliveredCount = deliveredAgg._count;
  const avgOrderValue =
    deliveredCount > 0 ? Math.round((deliveredAgg._sum.amount ?? 0) / deliveredCount) : 0;

  const cards = [
    { label: "Pending Orders", value: pendingOrders, href: "/admin/orders" },
    { label: "Pending Wallet Requests", value: pendingDeposits, href: "/admin/wallet-requests" },
    { label: "Total Users", value: totalUsers, href: undefined },
    {
      label: "Delivered Revenue",
      value: `${formatTaka(deliveredAgg._sum.amount ?? 0)} TK`,
      href: undefined,
    },
    { label: "Today's Orders (Delivered)", value: todayAgg._count, href: undefined },
    { label: "Yesterday's Orders (Delivered)", value: yesterdayAgg._count, href: undefined },
    {
      label: "Today's Sales (Delivered)",
      value: `${formatTaka(todayAgg._sum.amount ?? 0)} TK`,
      href: undefined,
    },
    {
      label: "Yesterday's Sales (Delivered)",
      value: `${formatTaka(yesterdayAgg._sum.amount ?? 0)} TK`,
      href: undefined,
    },
    { label: "Average Order Value", value: `${formatTaka(avgOrderValue)} TK`, href: undefined },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
