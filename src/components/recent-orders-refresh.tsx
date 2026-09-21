"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Re-runs the server render so the feed picks up new orders without a full
// page reload; the icon spins while the refresh is in flight.
export function RecentOrdersRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    startTransition(() => router.refresh());
    // Keep the spin visible for at least one rotation so a fast refresh still
    // reads as "something happened".
    setTimeout(() => setSpinning(false), 850);
  };

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      aria-label="Refresh latest orders"
      className={`latest-refresh ${spinning || isPending ? "is-refreshing" : ""}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"
        />
      </svg>
    </button>
  );
}
