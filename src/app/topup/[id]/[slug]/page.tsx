import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getProductById,
  getSiteSettings,
  getApprovedReviewsForProduct,
  getProductReviewStats,
  getUserReviewForProduct,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "@/components/order-form";
import { ReviewSection } from "@/components/review-section";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Params = { id: string; slug: string };

async function loadProduct(idParam: string) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getProductById(id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return { title: "Product Not Found" };

  const description =
    product.description ||
    `${product.name} - topupshop.co থেকে দ্রুত ও নিরাপদে টপআপ করুন। ${product.category} সার্ভিস।`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/topup/${product.id}/${product.slug}` },
    openGraph: {
      title: `${product.name} | topupshop.co`,
      description,
      images: [{ url: product.image, width: 800, height: 800 }],
    },
  };
}

export default async function TopupProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id, slug } = await params;
  const product = await loadProduct(id);

  if (!product || !product.isActive) notFound();

  if (product.type === "EXTERNAL_LINK" && product.externalUrl) {
    redirect(product.externalUrl);
  }

  if (slug !== product.slug) {
    redirect(`/topup/${product.id}/${product.slug}`);
  }

  const [session, settings, reviews, reviewStats] = await Promise.all([
    auth(),
    getSiteSettings(),
    getApprovedReviewsForProduct(product.id, 8),
    getProductReviewStats(product.id),
  ]);

  let walletBalance = 0;
  let userReview = null;
  if (session?.user) {
    const [user, existingReview] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { walletBalance: true },
      }),
      getUserReviewForProduct(product.id, session.user.id),
    ]);
    walletBalance = user?.walletBalance ?? 0;
    userReview = existingReview;
  }

  const rules = Array.isArray(product.rules) ? (product.rules as string[]) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image,
    description: product.description || `${product.name} topup - topupshop.co`,
    category: product.category,
    offers: product.rechargeOptions.map((option) => ({
      "@type": "Offer",
      name: option.label,
      price: option.price,
      priceCurrency: "BDT",
      availability: "https://schema.org/InStock",
    })),
    // Only attach rating markup once real approved reviews exist for this
    // product — must always mirror what's actually visible on the page.
    ...(reviewStats.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewStats.average.toFixed(1),
            reviewCount: reviewStats.count,
            bestRating: "5",
            worstRating: "1",
          },
          review: reviews.map((r) => ({
            "@type": "Review",
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: "5",
              worstRating: "1",
            },
            author: { "@type": "Person", name: r.user.name || "topupshop.co Customer" },
            reviewBody: r.comment,
            datePublished: r.createdAt.toISOString(),
          })),
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: product.category, item: `${siteUrl}/#topup` },
      { "@type": "ListItem", position: 3, name: product.name, item: `${siteUrl}/topup/${product.id}/${product.slug}` },
    ],
  };

  return (
    <div className="container m-auto my-3 px-2 md:my-5 md:px-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="product-hero-banner">
        <div className="product-hero-content">
          <span className="product-hero-image-card">
            <Image
              src={product.image}
              alt={product.name}
              width={82}
              height={82}
              className="product-hero-image"
            />
          </span>
          <div className="min-w-0">
            <h1 className="product-hero-title">{product.name}</h1>
            <span className="product-hero-chip">⚡ {product.category} / Top up</span>
          </div>
        </div>
      </div>

      <OrderForm
        productId={product.id}
        options={product.rechargeOptions}
        inputLabel={product.inputLabel}
        isLoggedIn={!!session?.user}
        walletBalance={walletBalance}
        stockOut={product.stockOut}
        allowGuestOrders={settings.allowGuestOrders}
        whatsappNumber={settings.whatsappNumber}
        paymentNumbers={{
          bkashNumber: settings.bkashNumber,
          nagadNumber: settings.nagadNumber,
          rocketNumber: settings.rocketNumber,
        }}
        paymentIcons={{
          bkashIcon: settings.bkashIcon,
          nagadIcon: settings.nagadIcon,
          rocketIcon: settings.rocketIcon,
          walletIcon: settings.walletIcon,
        }}
      />

      {rules.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:mt-8">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
            <h2 className="text-sm font-semibold text-gray-800 md:text-base">Rules &amp; Conditions</h2>
          </div>
          <ul className="list-inside list-disc space-y-2 p-3 text-sm leading-relaxed text-gray-700">
            {rules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      <ReviewSection
        productId={product.id}
        loginCallbackPath={`/topup/${product.id}/${product.slug}`}
        reviews={reviews}
        average={reviewStats.average}
        count={reviewStats.count}
        isLoggedIn={!!session?.user}
        userReview={userReview}
      />
    </div>
  );
}
