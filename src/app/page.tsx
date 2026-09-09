import type { Metadata } from "next";
import Link from "next/link";
import {
  getActiveBanners,
  getActiveNotice,
  getHomeProducts,
  getPublishedBlogPosts,
  getSiteSettings,
} from "@/lib/data";
import { NoticeBar } from "@/components/notice-bar";
import { Carousel } from "@/components/carousel";
import { ProductGrid } from "@/components/product-grid";
import { BlogPostCard } from "@/components/blog-post-card";
import { SocialLinksRow } from "@/components/social-links-row";

export const metadata: Metadata = {
  title: "topupshop.co - Free Fire Diamond TopUp | Largest TopUp Site In Bangladesh",
  description:
    "সবচেয়ে কম দামে ও দ্রুততম সময়ে Free Fire Diamond TopUp, UID TopUp, Weekly/Monthly Membership এবং Level Up Pass কিনুন। bKash, Nagad, Rocket পেমেন্টে ২৪ ঘন্টা অটোমেটিক ডেলিভারি।",
  alternates: { canonical: "/" },
};

export const revalidate = 60;

export default async function HomePage() {
  const [banners, notice, latestPosts, settings] = await Promise.all([
    getActiveBanners(),
    getActiveNotice(),
    getPublishedBlogPosts(4),
    getSiteSettings(),
  ]);

  // Admin toggle on /admin/settings — off keeps every product off the home page.
  const sections = settings.showHomeProducts ? await getHomeProducts() : [];

  return (
    <div className="p-2">
      {notice && <NoticeBar message={notice.message} />}

      <Carousel slides={banners} />

      <SocialLinksRow
        telegramLink={settings.telegramLink}
        facebookLink={settings.facebookLink}
        whatsappNumber={settings.whatsappNumber}
      />

      <div id="topup">
        {sections.map((section, index) => (
          <section key={section.id} className="my-3 md:my-10">
            <div className="container mx-auto">
              <div className="text-center">
                <div className="mt-0 flex items-center justify-center px-4 py-2 pb-4 md:mt-2 md:py-8">
                  {index === 0 ? (
                    <h1 className="mx-4 text-center font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">
                      {section.name}
                    </h1>
                  ) : (
                    <h2 className="mx-4 text-center font-primary text-2xl font-bold text-secondary-900 sm:text-3xl">
                      {section.name}
                    </h2>
                  )}
                </div>
              </div>
              <div className="pb-1 md:pb-10">
                <ProductGrid products={section.products} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="container mx-auto md:mb-10">
        <div className="my-5 flex items-center justify-center md:my-10">
          <a
            href="https://play.google.com/store/apps/details?id=com.bongoacademy.codzshop&hl=en"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 transition-shadow hover:shadow-md sm:gap-4 sm:py-3"
          >
            {/* Inline rather than the old /images/app_link.png, which is only
                48x11 and turned into a blurred sliver at this size. */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-8 w-8 shrink-0 text-primary-600 sm:h-10 sm:w-10"
              fill="currentColor"
            >
              <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.9-.18l13.363-7.514-3.263-3.239z" />
            </svg>
            <span className="text-xs font-bold leading-tight sm:text-base">
              Download Our Mobile App
              <br />
              <span className="text-primary-600">Get it on Google Play &rarr;</span>
            </span>
          </a>
        </div>
      </section>

      {latestPosts.length > 0 && (
        <section className="container mx-auto mb-8">
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
        </section>
      )}
    </div>
  );
}
