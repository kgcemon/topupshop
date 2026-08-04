import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { approveReviewAction, unapproveReviewAction, deleteReviewAction } from "@/lib/actions/admin-actions";
import { StarRating } from "@/components/star-rating";
import { formatDhakaDate } from "@/lib/utils";

function ReviewRow({
  review,
}: {
  review: {
    id: string;
    rating: number;
    comment: string;
    isApproved: boolean;
    createdAt: Date;
    user: { name: string | null; image: string | null };
    product: { id: number; name: string; slug: string };
  };
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{review.user.name || "User"}</span>
          <StarRating rating={review.rating} />
        </div>
        <span className="text-xs text-gray-400">
          {formatDhakaDate(review.createdAt, { dateStyle: "medium" })}
        </span>
      </div>
      <Link
        href={`/topup/${review.product.id}/${review.product.slug}`}
        target="_blank"
        className="mb-2 inline-block text-xs font-bold text-primary-600 hover:underline"
      >
        {review.product.name} &rarr;
      </Link>
      <p className="mb-3 text-sm text-gray-700">{review.comment}</p>
      <div className="flex items-center gap-2">
        {review.isApproved ? (
          <>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">Approved</span>
            <form action={unapproveReviewAction}>
              <input type="hidden" name="id" value={review.id} />
              <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                Unapprove
              </button>
            </form>
          </>
        ) : (
          <>
            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-700">Pending</span>
            <form action={approveReviewAction}>
              <input type="hidden" name="id" value={review.id} />
              <button className="rounded-md bg-primary-500 px-3 py-1 text-xs font-bold text-white hover:bg-primary-600">
                Approve
              </button>
            </form>
          </>
        )}
        <form action={deleteReviewAction}>
          <input type="hidden" name="id" value={review.id} />
          <button className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, image: true } },
      product: { select: { id: true, name: true, slug: true } },
    },
  });

  const pending = reviews.filter((r) => !r.isApproved);
  const approved = reviews.filter((r) => r.isApproved);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-1 text-lg font-bold">Reviews</h1>
        <p className="text-xs text-gray-500">
          এখানে অনুমোদন দিলেই রিভিউটি সংশ্লিষ্ট প্রোডাক্ট পেজে এবং গুগল সার্চের রিভিউ স্নিপেটে দেখাবে।
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">কোনো পেন্ডিং রিভিউ নেই।</p>
        ) : (
          <div className="space-y-3">
            {pending.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">Approved ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-gray-400">কোনো অনুমোদিত রিভিউ নেই।</p>
        ) : (
          <div className="space-y-3">
            {approved.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
