import { BlogPostForm } from "@/components/blog-form";
import { createBlogPostAction } from "@/lib/actions/admin-actions";

export default function NewBlogPostPage() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
      <h1 className="mb-4 text-lg font-bold">New Blog Post</h1>
      <BlogPostForm action={createBlogPostAction} submitLabel="Create Post" />
    </div>
  );
}
