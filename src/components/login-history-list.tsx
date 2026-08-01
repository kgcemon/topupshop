"use client";

import { useState } from "react";

type LoginHistoryEntry = {
  id: string;
  provider: string;
  ip: string;
  location: string | null;
  createdAt: Date;
};

export function LoginHistoryList({ history }: { history: LoginHistoryEntry[] }) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-bold text-primary-600 hover:underline"
      >
        {open ? "লগইন হিস্টরি লুকান" : `লগইন হিস্টরি দেখুন (${history.length})`}
      </button>

      {open && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-2 py-1.5 font-semibold">সময়</th>
                <th className="px-2 py-1.5 font-semibold">মাধ্যম</th>
                <th className="px-2 py-1.5 font-semibold">আইপি</th>
                <th className="px-2 py-1.5 font-semibold">লোকেশন</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString("bn-BD", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-2 py-1.5">{entry.provider}</td>
                  <td className="px-2 py-1.5">{entry.ip}</td>
                  <td className="px-2 py-1.5">{entry.location || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
