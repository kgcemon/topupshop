"use client";

import { useEffect, useRef, useState } from "react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notification-actions";
import { formatDhakaDateTime } from "@/lib/utils";

type NotificationItem = {
  id: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
  actor: { name: string | null; image: string | null } | null;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="নোটিফিকেশন"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-gray-200 transition-colors hover:border-primary-500"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Dim backdrop on mobile only, gives the panel a proper modal feel and
              also closes it on tap — the sm:hidden keeps it out of the way on desktop. */}
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-3 top-16 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:max-h-none sm:w-80 sm:max-w-[90vw]">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">নোটিফিকেশন</p>
              {unreadCount > 0 && (
                <form action={markAllNotificationsReadAction}>
                  <button type="submit" className="text-xs font-semibold text-primary-600 hover:underline">
                    সব পড়া হয়েছে
                  </button>
                </form>
              )}
            </div>

            <div className="overflow-y-auto sm:max-h-96">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">কোনো নোটিফিকেশন নেই।</p>
              ) : (
                notifications.map((n) => {
                const initial = (n.actor?.name || "U").trim().charAt(0).toUpperCase();
                return (
                  <form key={n.id} action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={n.id} />
                    <input type="hidden" name="link" value={n.link ?? ""} />
                    <button
                      type="submit"
                      className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                        !n.isRead ? "bg-primary-50/60" : ""
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-900 text-xs font-bold text-white">
                        {initial}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Plain text node — React escapes this automatically, so it
                            can never be interpreted as HTML/script even if the message
                            contains a user-chosen display name. */}
                        <span className="block text-sm text-gray-700">{n.message}</span>
                        <span className="mt-0.5 block text-[11px] text-gray-400">
                          {formatDhakaDateTime(n.createdAt, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                    </button>
                  </form>
                );
              })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5 text-gray-600"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  );
}
