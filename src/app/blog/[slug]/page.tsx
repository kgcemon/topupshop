import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { auth } from "@/lib/auth";
import { getBlogPostBySlug, isBlogPostLikedByUser, getLikedBlogCommentIds } from "@/lib/data";
import { formatTaka } from "@/lib/utils";
import { deleteBlogCommentAction } from "@/lib/actions/blog-actions";
import { BlogViewTracker } from "@/components/blog-view-tracker";
import { BlogLikeButton } from "@/components/blog-like-button";
import { BlogShareButton } from "@/components/blog-share-button";
import { BlogCommentForm } from "@/components/blog-comment-form";
import { BlogCommentLikeButton } from "@/components/blog-comment-like-button";
import { BlogCommentThread } from "@/components/blog-comment-thread";
import { EyeIcon, CommentIcon } from "@/components/blog-post-card";

type CommentUser = { id: string; name: string | null; image: string | null };
type CommentWithMeta = {
  id: string;
  content: string;
  createdAt: Date;
  user: CommentUser;
  _count: { likes: number };
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "পোস্ট পাওয়া যায়নি" };

  const description = post.metaDescription || post.excerpt || post.title;
  const keywords = post.metaKeywords
    ? post.metaKeywords.split(",").map((k) => k.trim()).filter(Boolean)
    : undefined;

  return {
    title: post.metaTitle || post.title,
    description,
    keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, session] = await Promise.all([getBlogPostBySlug(slug), auth()]);
  if (!post) notFound();

  const [contentHtml, isLiked, likedCommentIds] = await Promise.all([
    marked.parse(post.content),
    session?.user ? isBlogPostLikedByUser(post.id, session.user.id) : Promise.resolve(false),
    session?.user ? getLikedBlogCommentIds(post.id, session.user.id) : Promise.resolve(new Set<string>()),
  ]);

  const isAdmin = session?.user?.role === "ADMIN";
  const isLoggedIn = !!session?.user;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription || post.excerpt || post.title,
    image: post.coverImage ? [post.coverImage] : undefined,
    datePublished: post.publishedAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "Uc Ghor" },
    publisher: { "@type": "Organization", name: "Uc Ghor" },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReadAction",
        userInteractionCount: post.viewCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post._count.likes,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post._count.comments,
      },
    ],
  };

  return (
    <div className="container mx-auto max-w-3xl px-3 py-6 md:px-4 md:py-8">
      <BlogViewTracker postId={post.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/blog"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 hover:text-primary-700"
      >
        &larr; সব ব্লগ পোস্ট
      </Link>

      <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {post.coverImage ? (
          <div className="relative aspect-video w-full bg-gray-100">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              // See carousel.tsx — `priority` is deprecated in Next.js 16 and no
              // longer auto-sets fetchPriority, so it's passed explicitly here.
              preload
              fetchPriority="high"
            />
          </div>
        ) : (
          <div className="flex aspect-[21/9] w-full items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 font-primary text-2xl font-bold text-primary-600">
            Uc Ghor Blog
          </div>
        )}

        <div className="p-5 sm:p-8">
          <h1 className="mb-3 font-primary text-2xl leading-tight font-bold text-secondary-900 sm:text-3xl">
            {post.title}
          </h1>

          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 pb-6 text-sm text-gray-500">
            <span>{new Date(post.publishedAt).toLocaleDateString("bn-BD", { dateStyle: "long" })}</span>
            <span className="flex items-center gap-1.5">
              <EyeIcon />
              {formatTaka(post.viewCount)} ভিউ
            </span>
            <span className="flex items-center gap-1.5">
              <CommentIcon />
              {formatTaka(post._count.comments)} কমেন্ট
            </span>
            <span className="ml-auto flex items-center gap-2">
              <BlogLikeButton
                postId={post.id}
                slug={post.slug}
                isLiked={isLiked}
                likeCount={post._count.likes}
                isLoggedIn={!!session?.user}
              />
              <BlogShareButton title={post.title} url={`${siteUrl}/blog/${post.slug}`} />
            </span>
          </div>

          <div
            className="prose prose-sm sm:prose-base max-w-none prose-headings:font-primary prose-headings:text-secondary-900 prose-a:text-primary-600 prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>
      </article>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-secondary-900">
          <CommentIcon />
          মন্তব্য ({formatTaka(post._count.comments)})
        </h2>

        {session?.user ? (
          <BlogCommentForm postId={post.id} />
        ) : (
          <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            মন্তব্য করতে হলে{" "}
            <Link href="/login" className="font-bold text-primary-600">
              লগইন করুন
            </Link>
            ।
          </p>
        )}

        <div className="mt-6 space-y-5">
          {post.comments.length === 0 && (
            <p className="text-sm text-gray-500">এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্যটি আপনিই করুন!</p>
          )}
          {post.comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                postId={post.id}
                slug={post.slug}
                isAdmin={isAdmin}
                isLoggedIn={isLoggedIn}
                isLiked={likedCommentIds.has(comment.id)}
                likeCount={comment._count.likes}
              />
              <BlogCommentThread
                postId={post.id}
                parentId={comment.id}
                isLoggedIn={isLoggedIn}
                replyCount={comment.replies.length}
              >
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    postId={post.id}
                    slug={post.slug}
                    isAdmin={isAdmin}
                    isLoggedIn={isLoggedIn}
                    isLiked={likedCommentIds.has(reply.id)}
                    likeCount={reply._count.likes}
                  />
                ))}
              </BlogCommentThread>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CommentItem({
  comment,
  slug,
  isAdmin,
  isLoggedIn,
  isLiked,
  likeCount,
}: {
  comment: CommentWithMeta;
  postId: number;
  slug: string;
  isAdmin: boolean;
  isLoggedIn: boolean;
  isLiked: boolean;
  likeCount: number;
}) {
  const initial = (comment.user.name || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="flex gap-3">
      {comment.user.image ? (
        <Image
          src={comment.user.image}
          alt={comment.user.name ?? "User"}
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
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">{comment.user.name || "User"}</p>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-gray-400">
                {new Date(comment.createdAt).toLocaleDateString("bn-BD", { dateStyle: "medium" })}
              </p>
              {isAdmin && (
                <form action={deleteBlogCommentAction}>
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button className="text-[11px] font-bold text-red-500 hover:underline">Delete</button>
                </form>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm whitespace-pre-line text-gray-700">{comment.content}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-4 px-1">
          <BlogCommentLikeButton
            commentId={comment.id}
            slug={slug}
            isLiked={isLiked}
            likeCount={likeCount}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>
    </div>
  );
}
