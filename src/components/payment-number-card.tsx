"use client";

import { useState } from "react";

type Method = "BKASH" | "NAGAD" | "ROCKET";

const METHOD_STYLES: Record<Method, { solid: string; tint: string; label: string }> = {
  BKASH: { solid: "#E2136E", tint: "#FCE7F1", label: "bKash" },
  NAGAD: { solid: "#F42534", tint: "#FDE7E8", label: "Nagad" },
  ROCKET: { solid: "#8C3494", tint: "#F1E5F3", label: "Rocket" },
};

export function PaymentNumberCard({
  method,
  number,
  icon,
  warning,
}: {
  method: Method;
  number: string;
  icon?: React.ReactNode;
  /** Shown in place of the number — see SiteSetting.bkashMinWarning. */
  warning?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const style = METHOD_STYLES[method];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(number);
    } catch {
      const input = document.createElement("textarea");
      input.value = number;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const methodBadge = icon ?? (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: style.solid }}
    >
      {method.charAt(0)}
    </span>
  );

  // Below the admin's minimum amount the number is withheld and the warning
  // takes its place, so there is nothing to copy.
  if (warning) {
    return (
      <div className="overflow-hidden rounded-xl border border-amber-300">
        <div className="flex items-center gap-2 bg-amber-50 px-3 py-2">
          {methodBadge}
          <span className="text-xs font-bold" style={{ color: style.solid }}>
            {style.label}
          </span>
        </div>
        <div className="flex items-start gap-2 bg-white px-3 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            />
          </svg>
          <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-amber-800">{warning}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: style.solid }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: style.tint }}>
        {methodBadge}
        <span className="text-xs font-bold" style={{ color: style.solid }}>
          {style.label} Personal নাম্বারে Send Money করুন
        </span>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="flex w-full items-center justify-between gap-3 bg-white px-3 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
      >
        <span className="select-all font-mono text-lg font-bold tracking-wider text-secondary-900 sm:text-xl">
          {number}
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white transition-colors ${
            copied ? "bg-green-600" : ""
          }`}
          style={!copied ? { backgroundColor: style.solid } : undefined}
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
              কপি হয়েছে
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
              </svg>
              কপি করুন
            </>
          )}
        </span>
      </button>
    </div>
  );
}
