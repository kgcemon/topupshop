"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/auth-actions";
import { sendBroadcastNotificationAction } from "@/lib/actions/admin-actions";

const initialState: ActionState = {};

export function BroadcastNotificationForm() {
  const [state, formAction, pending] = useActionState(sendBroadcastNotificationAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold">Message</label>
        <textarea
          name="message"
          required
          rows={3}
          placeholder="সব ইউজারকে যে মেসেজটি পাঠাতে চান তা লিখুন..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {state.fieldErrors?.message && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold">Link (ঐচ্ছিক)</label>
        <input
          name="link"
          placeholder="/blog/some-post"
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "পাঠানো হচ্ছে..." : "সব ইউজারকে পাঠান"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm font-semibold text-primary-600">নোটিফিকেশন পাঠানো হয়েছে।</p>}
    </form>
  );
}
