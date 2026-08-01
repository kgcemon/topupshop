import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTaka, formatOrderNumber } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/status-badge";
import { LevelBadge } from "@/components/level-badge";
import { getLevelProgress } from "@/lib/levels";
import { getUserOrderStats, getLeaderboard, getDeliveredOrderStats } from "@/lib/data";

export default async function DashboardOverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, recentOrders, orderStats, leaderboard, deliveredStats] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { product: true },
    }),
    getUserOrderStats(userId),
    getLeaderboard(userId, 1),
    getDeliveredOrderStats(userId),
  ]);

  const { current, next, ordersToNext, progressPercent } = getLevelProgress(orderStats.completedOrders);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Wallet Balance</p>
        <p className="text-3xl font-bold text-primary-600">{formatTaka(user?.walletBalance ?? 0)} টাকা</p>
        <Link
          href="/dashboard/deposit"
          className="mt-4 inline-block rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
        >
          টাকা যোগ করুন
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">আপনার লেভেল</h2>
            <LevelBadge completedOrders={orderStats.completedOrders} />
          </div>
          {leaderboard.currentUserEntry.rank && (
            <Link href="/dashboard/leaderboard" className="text-sm font-semibold text-primary-600">
              র‍্যাংক #{leaderboard.currentUserEntry.rank} &rarr;
            </Link>
          )}
        </div>

        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-xs text-gray-500">
          {next
            ? `${current.labelBn} থেকে ${next.labelBn} লেভেলে যেতে আর ${ordersToNext} টি সফল অর্ডার লাগবে`
            : "আপনি সর্বোচ্চ লেভেলে পৌঁছে গেছেন!"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          মোট সফল অর্ডার: <span className="font-semibold">{orderStats.completedOrders}</span> · মোট খরচ:{" "}
          <span className="font-semibold">{formatTaka(orderStats.totalSpent)} টাকা</span>
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold">অ্যানালিটিক্স</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xl font-bold text-primary-600">{deliveredStats.deliveredOrders}</p>
            <p className="mt-1 text-xs text-gray-500">মোট অর্ডার (ডেলিভারড)</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xl font-bold text-primary-600">{formatTaka(deliveredStats.deliveredAmount)}</p>
            <p className="mt-1 text-xs text-gray-500">মোট এমাউন্ট (টাকা)</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-xl font-bold text-primary-600">
              {leaderboard.currentUserEntry.rank ? `#${leaderboard.currentUserEntry.rank}` : "-"}
            </p>
            <p className="mt-1 text-xs text-gray-500">র‍্যাংক</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">সাম্প্রতিক অর্ডার</h2>
          <Link href="/dashboard/orders" className="text-sm font-semibold text-primary-600">
            সব দেখুন &rarr;
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-gray-500">এখনো কোনো অর্ডার নেই।</p>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{order.product.name}</p>
                  <p className="text-xs text-gray-500">{formatOrderNumber(order.orderSerial)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatTaka(order.amount)} TK</span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
