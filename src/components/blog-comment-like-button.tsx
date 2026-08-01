import { toggleBlogCommentLikeAction } from "@/lib/actions/blog-actions";
import { HeartIcon } from "@/components/blog-post-card";

export function BlogCommentLikeButton({
  commentId,
  slug,
  isLiked,
  likeCount,
  isLoggedIn,
}: {
  commentId: string;
  slug: string;
  isLiked: boolean;
  likeCount: number;
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-gray-400">
        <HeartIcon filled={false} />
        {likeCount}
      </span>
    );
  }

  return (
    <form action={toggleBlogCommentLikeAction} className="inline-block">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className={`flex items-center gap-1 text-xs font-bold transition-colors ${
          isLiked ? "text-red-600" : "text-gray-400 hover:text-red-600"
        }`}
      >
        <HeartIcon filled={isLiked} />
        {likeCount}
      </button>
    </form>
  );
}
