import Link from "next/link";
import { toggleBlogLikeAction } from "@/lib/actions/blog-actions";
import { HeartIcon } from "@/components/blog-post-card";

export function BlogLikeButton({
  postId,
  slug,
  isLiked,
  likeCount,
  isLoggedIn,
}: {
  postId: number;
  slug: string;
  isLiked: boolean;
  likeCount: number;
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-1.5 text-sm font-bold text-gray-500 transition-colors hover:border-red-200 hover:text-red-600"
      >
        <HeartIcon filled={false} />
        {likeCount}
      </Link>
    );
  }

  return (
    <form action={toggleBlogLikeAction}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
          isLiked
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600"
        }`}
      >
        <HeartIcon filled={isLiked} />
        {likeCount}
      </button>
    </form>
  );
}
