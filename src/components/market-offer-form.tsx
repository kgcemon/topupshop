"use client";

import { useActionState } from "react";
import { createMarketOfferAction, type MarketOfferActionState } from "@/lib/actions/market-actions";

const initialState: MarketOfferActionState = {};

export function MarketOfferForm({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(createMarketOfferAction, initialState);
  const formKey = JSON.stringify(state);

  if (state.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        আপনার অফারটি পাঠানো হয়েছে। আমাদের টিম রিভিউ করে শীঘ্রই আপনার সাথে যোগাযোগ করবে।
      </div>
    );
  }

  return (
    <form key={formKey} action={formAction} className="rounded-lg border border-gray-200 bg-white p-4">
      <input type="hidden" name="listingId" value={listingId} />
      <label className="mb-1 block text-sm font-semibold">আপনার অফার প্রাইস (৳)</label>
      <input
        name="offerPrice"
        type="number"
        min={1}
        defaultValue={state.values?.offerPrice}
        placeholder="যেমনঃ 1200"
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {state.fieldErrors?.offerPrice && <p className="mb-2 text-sm text-red-600">{state.fieldErrors.offerPrice}</p>}

      <label className="mb-1 block text-sm font-semibold">মেসেজ (অপশনাল)</label>
      <textarea
        name="message"
        rows={2}
        defaultValue={state.values?.message}
        placeholder="যেমনঃ আজকেই নিতে চাই, ডেলিভারি কবে দেয়া যাবে?"
        className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {state.fieldErrors?.message && <p className="mb-2 text-sm text-red-600">{state.fieldErrors.message}</p>}

      {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary-500 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "পাঠানো হচ্ছে..." : "অফার পাঠান"}
      </button>
    </form>
  );
}
