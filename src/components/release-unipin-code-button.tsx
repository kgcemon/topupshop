"use client";

import { releaseUnipinCodeAction } from "@/lib/actions/unipin-actions";

export function ReleaseUnipinCodeButton({ codeId, code, redeemed }: { codeId: string; code: string; redeemed: boolean }) {
  const warning = redeemed
    ? `কোড "${code}" ইতিমধ্যে UniPin API-তে রিডিম হয়ে গ্রাহককে দেওয়া হয়েছে। এটি Unused করলে একই কোড আবার অন্য অর্ডারে ব্যবহার হতে পারে, যা গ্রাহকের জন্য কাজ নাও করতে পারে। তবুও Unused করবেন?`
    : `কোড "${code}" আবার Unused করবেন? এটি এখন পুল-এ ফিরে যাবে এবং অন্য অর্ডারে ব্যবহার করা যাবে।`;

  return (
    <form
      action={releaseUnipinCodeAction}
      onSubmit={(e) => {
        if (!confirm(warning)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="codeId" value={codeId} />
      <button
        type="submit"
        className="rounded-md border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50"
      >
        Unused করুন
      </button>
    </form>
  );
}
