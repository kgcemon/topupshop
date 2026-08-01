import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BlogPostForm } from "@/components/blog-form";
import { updateBlogPostAction, deleteBlogPostAction } from "@/lib/actions/admin-actions";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  const post = await prisma.blogPost.findUnique({ where: { id: postId } });

  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-4 text-lg font-bold">Edit Post: {post.title}</h1>
        <BlogPostForm
          action={updateBlogPostAction}
          submitLabel="Save Changes"
          defaultValues={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            coverImage: post.coverImage,
            metaTitle: post.metaTitle,
            metaDescription: post.metaDescription,
            metaKeywords: post.metaKeywords,
            isPublished: post.isPublished,
          }}
        />
      </div>

      <div className="rounded-xl border border-red-200 bg-white p-3 sm:p-6">
        <h2 className="mb-2 text-sm font-bold text-red-600">Delete Post</h2>
        <p className="mb-3 text-xs text-gray-500">এই পোস্টটি স্থায়ীভাবে মুছে যাবে, ফিরিয়ে আনা যাবে না।</p>
        <form action={deleteBlogPostAction}>
          <input type="hidden" name="postId" value={post.id} />
          <button className="rounded-md border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
            Delete Post
          </button>
        </form>
      </div>
    </div>
  );
}
