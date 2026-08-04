"use client";

import { useEffect, useRef, useState } from "react";
import { blockUserAction, unblockUserAction } from "@/lib/actions/admin-actions";
import { formatDhakaDate } from "@/lib/utils";

export function UserBlockControl({
  userId,
  isBlocked,
  blockedUntil,
  blockReason,
}: {
  userId: string;
  isBlocked: boolean;
  blockedUntil: Date | null;
  blockReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (isBlocked) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
          ব্লকড {blockedUntil ? `· ${formatDhakaDate(blockedUntil, { dateStyle: "medium" })} পর্যন্ত` : "· স্থায়ী"}
        </span>
        {blockReason && <span className="text-xs text-gray-500">({blockReason})</span>}
        <form action={unblockUserAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-primary-500 hover:text-primary-600"
          >
            আনব্লক করুন
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-red-300 hover:text-red-600"
      >
        ব্লক করুন
      </button>

      {open && (
        <form
          action={blockUserAction}
          className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
        >
          <input type="hidden" name="userId" value={userId} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">মেয়াদ</label>
            <select
              name="duration"
              defaultValue="permanent"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            >
              <option value="1">১ দিন</option>
              <option value="3">৩ দিন</option>
              <option value="7">৭ দিন</option>
              <option value="30">৩০ দিন</option>
              <option value="permanent">স্থায়ী</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">কারণ (ঐচ্ছিক)</label>
            <input
              name="reason"
              placeholder="যেমন: ভুয়া অর্ডার, প্রতারণা"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-red-600 py-1.5 text-xs font-bold text-white hover:bg-red-700"
          >
            নিশ্চিত করুন
          </button>
        </form>
      )}
    </div>
  );
}
