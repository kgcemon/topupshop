"use client";

import { useState } from "react";
import { formatTaka, formatOrderNumber, formatDhakaDateTime } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/status-badge";

type OrderHistoryEntry = {
  id: string;
  orderSerial: number;
  productName: string;
  optionLabel: string;
  amount: number;
  status: string;
  paymentMethod: string;
  transactionId: string | null;
  createdAt: Date;
};

export function OrderHistoryList({ history }: { history: OrderHistoryEntry[] }) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-primary-600 hover:underline"
      >
        {open ? "অর্ডার হিস্টরি লুকান" : `অর্ডার হিস্টরি দেখুন (${history.length})`}
      </button>

      {open && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-2 py-1.5 font-semibold">অর্ডার</th>
                <th className="px-2 py-1.5 font-semibold">প্রোডাক্ট</th>
                <th className="px-2 py-1.5 font-semibold">এমাউন্ট</th>
                <th className="px-2 py-1.5 font-semibold">পেমেন্ট</th>
                <th className="px-2 py-1.5 font-semibold">Trx ID</th>
                <th className="px-2 py-1.5 font-semibold">স্ট্যাটাস</th>
                <th className="px-2 py-1.5 font-semibold">সময়</th>
              </tr>
            </thead>
            <tbody>
              {history.map((order) => (
                <tr key={order.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                    {formatOrderNumber(order.orderSerial)}
                  </td>
                  <td className="px-2 py-1.5">
                    {order.productName}
                    <span className="block text-[10px] text-gray-500">{order.optionLabel}</span>
                  </td>
                  <td className="px-2 py-1.5 font-bold whitespace-nowrap">{formatTaka(order.amount)} TK</td>
                  <td className="px-2 py-1.5">{order.paymentMethod}</td>
                  <td className="px-2 py-1.5 font-mono">{order.transactionId || "-"}</td>
                  <td className="px-2 py-1.5">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {formatDhakaDateTime(order.createdAt, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
