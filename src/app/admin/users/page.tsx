import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatTaka, formatDhakaDate } from "@/lib/utils";
import { UserBlockControl } from "@/components/user-block-control";
import { LoginHistoryList } from "@/components/login-history-list";
import { OrderHistoryList } from "@/components/order-history-list";
import { AddManagerForm } from "@/components/add-manager-form";
import { RemoveManagerButton } from "@/components/remove-manager-button";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const [users, totalUsers, totalAdmins, totalManagers] = await Promise.all([
    prisma.user.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: { select: { orders: true, referrals: true } },
        referredBy: { select: { name: true, email: true } },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "MANAGER" } }),
  ]);

  const userIds = users.map((u) => u.id);

  const [loginLogs, orders] = await Promise.all([
    prisma.loginLog.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true } }, rechargeOption: { select: { label: true } } },
    }),
  ]);

  const loginLogsByUser = new Map<string, typeof loginLogs>();
  for (const log of loginLogs) {
    const list = loginLogsByUser.get(log.userId) ?? [];
    if (list.length < 20) list.push(log);
    loginLogsByUser.set(log.userId, list);
  }

  const orderHistoryByUser = new Map<
    string,
    {
      id: string;
      orderSerial: number;
      productName: string;
      optionLabel: string;
      amount: number;
      status: string;
      paymentMethod: string;
      transactionId: string | null;
      createdAt: Date;
    }[]
  >();
  for (const order of orders) {
    if (!order.userId) continue;
    const list = orderHistoryByUser.get(order.userId) ?? [];
    if (list.length < 20) {
      list.push({
        id: order.id,
        orderSerial: order.orderSerial,
        productName: order.product.name,
        optionLabel: order.rechargeOption.label,
        amount: order.amount,
        status: order.status,
        paymentMethod: order.paymentMethod,
        transactionId: order.transactionId,
        createdAt: order.createdAt,
      });
    }
    orderHistoryByUser.set(order.userId, list);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Users</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">Total {totalUsers}</span>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">Admins {totalAdmins}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Managers {totalManagers}</span>
        </div>
      </div>

      <div className="mb-4">
        <AddManagerForm />
      </div>

      <form className="mb-4">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="নাম, ইমেইল বা ফোন নাম্বার দিয়ে খুঁজুন..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-sm"
        />
      </form>

      <div className="space-y-3">
        {users.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            কোনো ইউজার পাওয়া যায়নি।
          </p>
        )}
        {users.map((user) => {
          const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
          const joined = formatDhakaDate(user.createdAt, { dateStyle: "medium" });

          return (
            <div key={user.id} className="rounded-lg border border-gray-200 p-3 text-sm sm:p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name ?? "User"}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-900 text-sm font-bold text-white">
                      {initial}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold">{user.name || "নাম নেই"}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    user.role === "ADMIN"
                      ? "bg-secondary-900 text-white"
                      : user.role === "MANAGER"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <InfoBox label="Wallet Balance" value={`${formatTaka(user.walletBalance)} TK`} highlight />
                <InfoBox label="ফোন" value={user.phone || "-"} />
                <InfoBox label="মোট অর্ডার" value={String(user._count.orders)} />
                <InfoBox label="যোগ দিয়েছেন" value={joined} />
                <InfoBox label="রেফার করেছেন" value={String(user._count.referrals)} />
                <InfoBox label="যার মাধ্যমে জয়েন" value={user.referredBy?.name || user.referredBy?.email || "-"} />
                <InfoBox label="সোর্স" value={user.signupSource || "Direct"} />
                <InfoBox label="সর্বশেষ লোকেশন" value={user.lastLoginLocation || "-"} />
                <InfoBox label="মোট লগইন" value={String(user.loginCount)} />
              </div>

              <OrderHistoryList history={orderHistoryByUser.get(user.id) ?? []} />
              <LoginHistoryList history={loginLogsByUser.get(user.id) ?? []} />

              {user.role === "MANAGER" && (
                <div className="mt-2 flex justify-end border-t border-gray-100 pt-2">
                  <RemoveManagerButton userId={user.id} />
                </div>
              )}

              {user.role === "USER" && (
                <div className="mt-2 flex justify-end border-t border-gray-100 pt-2">
                  <UserBlockControl
                    userId={user.id}
                    isBlocked={user.isBlocked}
                    blockedUntil={user.blockedUntil}
                    blockReason={user.blockReason}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`min-w-0 rounded-md px-2.5 py-1.5 ${
        highlight ? "border border-primary-100 bg-primary-50" : "bg-gray-50"
      }`}
    >
      <p className={`text-[10px] font-bold tracking-wide uppercase ${highlight ? "text-primary-700" : "text-gray-500"}`}>
        {label}
      </p>
      <p className="truncate text-xs font-bold text-gray-900">{value}</p>
    </div>
  );
}
