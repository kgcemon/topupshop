"use client";

import { useState } from "react";

export function NoticeBar({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="container mx-auto mt-4 px-3 md:px-4">
      <div className="flex items-start justify-between gap-3 rounded-lg bg-primary-500 px-3 py-2.5 md:px-4 md:py-3">
        <p className="text-xs text-white md:text-sm">
          <span className="font-bold">Notice: </span>
          {message}
        </p>
        <button
          onClick={() => setVisible(false)}
          aria-label="বন্ধ করুন"
          className="shrink-0 text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
