import Image from "next/image";
import Link from "next/link";
import { StarRating } from "@/components/star-rating";
import { ReviewForm } from "@/components/review-form";
import { formatDhakaDate } from "@/lib/utils";

type ReviewWithUser = {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
  user: { name: string | null; image: string | null };
};

function ReviewCard({ review }: { review: ReviewWithUser }) {
  const initial = (review.user.name || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-3">
        {review.user.image ? (
          <Image
            src={review.user.image}
            alt={review.user.name ?? "User"}
            width={36}
            height={36}
            unoptimized
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-900 text-xs font-bold text-white">
            {initial}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900">{review.user.name || "User"}</p>
          <p className="text-[11px] text-gray-400">
            {formatDhakaDate(review.createdAt, { dateStyle: "medium" })}
          </p>
        </div>
      </div>
      <StarRating rating={review.rating} />
      <p className="mt-2 line-clamp-4 flex-1 text-sm text-gray-600">{review.comment}</p>
    </div>
  );
}

export function ReviewSection({
  productId,
  loginCallbackPath,
  reviews,
  average,
  count,
  isLoggedIn,
  userReview,
}: {
  productId: number;
  loginCallbackPath: string;
  reviews: ReviewWithUser[];
  average: number;
  count: number;
  isLoggedIn: boolean;
  userReview: { rating: number; comment: string } | null;
}) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold">Reviews</h2>
        {count > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-secondary-900">{average.toFixed(1)}</span>
            <StarRating rating={average} size="h-5 w-5" />
            <span className="text-sm text-gray-500">({count} রিভিউ)</span>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {isLoggedIn ? (
        <ReviewForm
          productId={productId}
          existingRating={userReview?.rating}
          existingComment={userReview?.comment}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-700">এই প্রোডাক্ট সম্পর্কে আপনার অভিজ্ঞতা শেয়ার করতে চান?</p>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(loginCallbackPath)}`}
            className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
          >
            রিভিউ দিতে লগইন করুন
          </Link>
        </div>
      )}
    </div>
  );
}
