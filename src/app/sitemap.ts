import type { MetadataRoute } from "next";
import { getAllActiveProductsForSitemap, getAllPublishedBlogPostsForSitemap } from "@/lib/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, blogPosts] = await Promise.all([
    getAllActiveProductsForSitemap(),
    getAllPublishedBlogPostsForSitemap(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/contact-us`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/register`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/topup/${product.id}/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...blogRoutes];
}
