import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getActiveBanners, getActiveNotice, getHomeProducts, getPublishedBlogPosts } from "@/lib/data";
import { NoticeBar } from "@/components/notice-bar";
import { Carousel } from "@/components/carousel";
import { ProductGrid } from "@/components/product-grid";
import { InstallAppPopup } from "@/components/install-app-popup";
import { BlogPostCard } from "@/components/blog-post-card";

export const metadata: Metadata = {
  title: "Uc Ghor - Free Fire Diamond TopUp | Largest TopUp Site In Bangladesh",
  description:
    "সবচেয়ে কম দামে ও দ্রুততম সময়ে Free Fire Diamond TopUp, UID TopUp, Weekly/Monthly Membership এবং Level Up Pass কিনুন। bKash, Nagad, Rocket পেমেন্টে ২৪ ঘন্টা অটোমেটিক ডেলিভারি।",
  alternates: { canonical: "/" },
};

export const revalidate = 60;

export default async function HomePage() {
  const [banners, notice, sections, latestPosts] = await Promise.all([
    getActiveBanners(),
    getActiveNotice(),
    getHomeProducts(),
    getPublishedBlogPosts(4),
  ]);

  return (
    <>
      {notice && <NoticeBar message={notice.message} />}

      <Carousel slides={banners} />

      <div id="topup">
        {sections.map((section, index) => (
          <div key={section.id}>
            <section className="flex items-center justify-center px-3 pt-2 pb-4 md:px-4 md:pt-2 md:pb-8">
              {index === 0 ? (
                <h1 className="mx-4 text-center font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">
                  {section.name}
                </h1>
              ) : (
                <h2 className="mx-4 text-center font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">
                  {section.name}
                </h2>
              )}
            </section>
            <div className="container mx-auto px-3 pb-1 md:px-4 md:pb-10">
              <ProductGrid products={section.products} />
            </div>
          </div>
        ))}
      </div>

      <div className="container mx-auto mb-8 flex flex-nowrap items-center justify-center gap-2 px-3 sm:gap-4 md:px-4">
        <a
          href="#"
          className="flex flex-1 items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-2.5 py-1.5 transition-shadow hover:shadow-md sm:flex-none sm:gap-3 sm:px-4 sm:py-2"
        >
          <Image
            src="/images/app_link.png"
            alt="Google Play"
            width={32}
            height={32}
            className="h-6 w-6 shrink-0 object-contain sm:h-8 sm:w-8"
          />
          <span className="text-[11px] font-bold leading-tight sm:text-sm">
            Download Our Mobile App
            <br />
            <span className="text-primary-600">Click Here &rarr;</span>
          </span>
        </a>
        <a
          href="https://t.me/+K3PmqW02YCI2OGRl"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-2.5 py-1.5 transition-shadow hover:shadow-md sm:flex-none sm:gap-3 sm:px-4 sm:py-2"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 sm:h-8 sm:w-8">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-4 w-4 sm:h-5 sm:w-5">
              <path d="M21.05 3.79 2.6 10.98c-1.24.5-1.23 1.2-.23 1.5l4.72 1.47 1.82 5.53c.22.6.37.84.75.84.38 0 .55-.17.75-.38l1.8-1.75 4.75 3.5c.87.48 1.5.23 1.72-.8L22 5.06c.3-1.26-.48-1.83-1.95-1.27Z" />
            </svg>
          </span>
          <span className="text-[11px] font-bold leading-tight sm:text-sm">
            Giveway &amp; Offer Update
            <br />
            <span className="text-sky-600">Join Telegram</span>
          </span>
        </a>
      </div>

      {latestPosts.length > 0 && (
        <div className="container mx-auto mb-8 px-3 md:px-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">Blog</h2>
            <Link href="/blog" className="text-sm font-bold text-primary-600 hover:text-primary-700">
              সব দেখুন &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {latestPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      <InstallAppPopup />
    </>
  );
}
