"use client";

import { useActionState, useEffect, useRef } from "react";
import { changeOwnPasswordAction } from "@/lib/actions/admin-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="max-w-sm space-y-3">
      <div>
        <label htmlFor="currentPassword" className="mb-1 block text-xs font-bold text-gray-500">
          বর্তমান পাসওয়ার্ড
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {state.fieldErrors?.currentPassword && (
          <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.currentPassword}</p>
        )}
      </div>

      <div>
        <label htmlFor="newPassword" className="mb-1 block text-xs font-bold text-gray-500">
          নতুন পাসওয়ার্ড
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {state.fieldErrors?.newPassword && (
          <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.newPassword}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-xs font-bold text-gray-500">
          নতুন পাসওয়ার্ড আবার লিখুন
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {state.fieldErrors?.confirmPassword && (
          <p className="mt-1 text-[11px] text-red-600">{state.fieldErrors.confirmPassword}</p>
        )}
      </div>

      {state.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm font-semibold text-green-600">পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary-500 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-600 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "সেভ হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
      </button>
    </form>
  );
}
