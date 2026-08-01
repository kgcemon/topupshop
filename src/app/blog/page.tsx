import type { Metadata } from "next";
import { getPublishedBlogPosts } from "@/lib/data";
import { BlogPostCard } from "@/components/blog-post-card";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "ব্লগ",
  description:
    "TopUpsBD ব্লগে Free Fire Diamond TopUp, গেমিং টিপস ও নতুন অফার সম্পর্কে সর্বশেষ আপডেট পড়ুন।",
  alternates: { canonical: "/blog" },
};

export const revalidate = 300;

export default async function BlogListPage() {
  const posts = await getPublishedBlogPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "TopUpsBD Blog",
    url: `${siteUrl}/blog`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <div className="container mx-auto px-3 py-8 md:px-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="flex items-center justify-center px-3 pt-2 pb-6">
        <h1 className="mx-4 text-center font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">
          Blog
        </h1>
      </section>

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
          এখনো কোনো পোস্ট প্রকাশিত হয়নি। শীঘ্রই আসছে!
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
