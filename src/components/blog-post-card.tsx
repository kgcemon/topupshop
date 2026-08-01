import Image from "next/image";
import Link from "next/link";
import { formatTaka } from "@/lib/utils";

type CardPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date;
  viewCount: number;
  _count: { likes: number; comments: number };
};

export function BlogPostCard({ post }: { post: CardPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex overflow-hidden rounded-xl border border-gray-200 bg-white transition-all active:scale-[0.98] sm:flex-col sm:active:scale-100 sm:hover:-translate-y-0.5 sm:hover:shadow-lg"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100 sm:h-44 sm:w-full">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 sm:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-primary text-[11px] font-bold text-primary-600 sm:text-lg">
            Uc Ghor
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-3 sm:justify-start sm:p-4">
        <p className="mb-1 text-[11px] text-gray-500 sm:text-xs">
          {new Date(post.publishedAt).toLocaleDateString("bn-BD", { dateStyle: "medium" })}
        </p>
        <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-snug text-gray-900 group-hover:text-primary-600 sm:text-base">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mb-3 line-clamp-2 hidden flex-1 text-sm text-gray-600 sm:block">{post.excerpt}</p>
        )}

        <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-gray-500 sm:mt-auto sm:border-t sm:border-gray-100 sm:pt-3">
          <span className="flex items-center gap-1">
            <EyeIcon />
            {formatTaka(post.viewCount)}
          </span>
          <span className="flex items-center gap-1">
            <HeartIcon filled={post._count.likes > 0} />
            {formatTaka(post._count.likes)}
          </span>
          <span className="flex items-center gap-1">
            <CommentIcon />
            {formatTaka(post._count.comments)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      className="h-3.5 w-3.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"
      />
    </svg>
  );
}

export function CommentIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
      />
    </svg>
  );
}
