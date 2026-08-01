"use client";

import { useActionState, useState } from "react";
import { submitReviewAction } from "@/lib/actions/review-actions";
import type { ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = {};

export function ReviewForm({
  productId,
  existingRating,
  existingComment,
}: {
  productId: number;
  existingRating?: number;
  existingComment?: string;
}) {
  const [state, formAction, pending] = useActionState(submitReviewAction, initialState);
  const [rating, setRating] = useState(existingRating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);

  if (state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm font-semibold text-green-700">
        ধন্যবাদ! আপনার রিভিউ জমা হয়েছে, অনুমোদনের পর এটি এখানে দেখানো হবে।
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <form action={formAction} className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="mb-2 text-sm font-bold text-gray-900">
        {existingRating ? "আপনার রিভিউ পরিবর্তন করুন" : "আপনার অভিজ্ঞতা শেয়ার করুন"}
      </p>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div
        className="mb-3 flex items-center gap-1"
        onMouseLeave={() => setHoverRating(0)}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              aria-label={`${value} স্টার`}
              className="p-0.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={value <= displayRating ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
                className={`h-7 w-7 transition-colors ${value <= displayRating ? "text-amber-400" : "text-gray-300"}`}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.8-4.6 6.6-.9L12 2.5Z"
                />
              </svg>
            </button>
          );
        })}
      </div>
      {state.fieldErrors?.rating && <p className="mb-2 text-xs text-red-600">{state.fieldErrors.rating}</p>}

      <textarea
        name="comment"
        rows={3}
        required
        defaultValue={existingComment}
        placeholder="আপনার অভিজ্ঞতা লিখুন..."
        className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
      />
      {state.fieldErrors?.comment && <p className="mb-2 text-xs text-red-600">{state.fieldErrors.comment}</p>}
      {state.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || rating < 1}
        className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {pending ? "জমা হচ্ছে..." : existingRating ? "আপডেট করুন" : "রিভিউ জমা দিন"}
      </button>
    </form>
  );
}
