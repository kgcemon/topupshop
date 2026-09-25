"use client";

import { useActionState } from "react";
import { runBackupNowAction } from "@/lib/actions/backup-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function BackupRunButton({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(runBackupNowAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <button
        disabled={pending || disabled}
        className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {/* A dump + upload takes a while, so say so instead of looking frozen. */}
        {pending ? "ব্যাকআপ নেওয়া হচ্ছে... (কয়েক মিনিট লাগতে পারে)" : "এখনই ব্যাকআপ নিন"}
      </button>
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          ব্যাকআপ Google Drive-এ আপলোড হয়েছে।
        </p>
      )}
    </form>
  );
}
