"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createManagerAction } from "@/lib/actions/admin-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function AddManagerForm() {
  const [state, formAction, pending] = useActionState(createManagerAction, initialState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-secondary-900 px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90"
      >
        + ম্যানেজার যোগ করুন
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">নতুন ম্যানেজার যোগ করুন</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-bold text-gray-500 hover:text-gray-700"
        >
          বন্ধ করুন
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-500">নাম</label>
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          {state.fieldErrors?.name && <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.name}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-500">ইমেইল</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          {state.fieldErrors?.email && <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.email}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-gray-500">পাসওয়ার্ড</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          {state.fieldErrors?.password && (
            <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.password}</p>
          )}
        </div>
      </div>

      {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm font-semibold text-green-600">ম্যানেজার সফলভাবে যোগ হয়েছে</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary-500 px-4 py-2 text-xs font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "যোগ হচ্ছে..." : "ম্যানেজার যোগ করুন"}
      </button>
    </form>
  );
}
