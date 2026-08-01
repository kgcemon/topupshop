"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

export function SecretField({ value, placeholder = "—" }: { value?: string | null; placeholder?: string }) {
  const [visible, setVisible] = useState(false);

  if (!value) {
    return <span className="text-xs text-gray-400">{placeholder}</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-xs">{visible ? value : "•".repeat(Math.min(value.length, 10))}</span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="shrink-0 rounded-md border border-gray-300 px-1.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50"
      >
        {visible ? "Hide" : "Show"}
      </button>
      <CopyButton value={value} label="" />
    </div>
  );
}
