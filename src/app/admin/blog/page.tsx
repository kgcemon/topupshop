import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { toggleBlogPostPublishedAction } from "@/lib/actions/admin-actions";
import { formatDhakaDate } from "@/lib/utils";

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Blog Posts</h1>
        <Link
          href="/admin/blog/new"
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
        >
          + New Post
        </Link>
      </div>

      <div className="space-y-3">
        {posts.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            এখনো কোনো ব্লগ পোস্ট নেই।
          </p>
        )}
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {post.coverImage ? (
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
                  No image
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold">{post.title}</p>
                <p className="truncate text-xs text-gray-500">
                  /{post.slug} ·{" "}
                  {formatDhakaDate(post.publishedAt, { dateStyle: "medium" })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  post.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {post.isPublished ? "Published" : "Draft"}
              </span>
              <Link
                href={`/admin/blog/${post.id}/edit`}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50"
              >
                Edit
              </Link>
              <form action={toggleBlogPostPublishedAction}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="isPublished" value={String(post.isPublished)} />
                <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                  {post.isPublished ? "Unpublish" : "Publish"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
