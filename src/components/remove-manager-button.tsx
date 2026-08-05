"use client";

import { removeManagerAction } from "@/lib/actions/admin-actions";

export function RemoveManagerButton({ userId }: { userId: string }) {
  return (
    <form
      action={removeManagerAction}
      onSubmit={(e) => {
        if (!confirm("এই ম্যানেজারকে সাধারণ ইউজারে পরিবর্তন করবেন?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-600 hover:border-red-300 hover:text-red-600"
      >
        ম্যানেজার সরান
      </button>
    </form>
  );
}
