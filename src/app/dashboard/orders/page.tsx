import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTaka, formatOrderNumber } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/status-badge";

export default async function OrderHistoryPage() {
  const session = await auth();
  const userId = session!.user.id;

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: true, rechargeOption: true },
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <h1 className="mb-4 text-lg font-bold">Order History</h1>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">এখনো কোনো অর্ডার করা হয়নি।</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.product.name}</p>
                    <p className="text-xs text-gray-500">{order.rechargeOption.label}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600">
                  <dt>Order</dt>
                  <dd className="text-right font-mono">{formatOrderNumber(order.orderSerial)}</dd>
                  <dt>Player ID</dt>
                  <dd className="text-right">{order.playerId}</dd>
                  <dt>Amount</dt>
                  <dd className="text-right font-bold text-gray-900">{formatTaka(order.amount)} TK</dd>
                  <dt>Method</dt>
                  <dd className="text-right">{order.paymentMethod}</dd>
                  <dt>Date</dt>
                  <dd className="text-right">{new Date(order.createdAt).toLocaleString("bn-BD")}</dd>
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Player ID</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100">
                    <td className="py-3 pr-3 font-mono text-xs">{formatOrderNumber(order.orderSerial)}</td>
                    <td className="py-3 pr-3">
                      {order.product.name}
                      <span className="block text-xs text-gray-500">{order.rechargeOption.label}</span>
                    </td>
                    <td className="py-3 pr-3">{order.playerId}</td>
                    <td className="py-3 pr-3 font-bold">{formatTaka(order.amount)} TK</td>
                    <td className="py-3 pr-3">{order.paymentMethod}</td>
                    <td className="py-3 pr-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString("bn-BD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
