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
    `${product.name} - TopUpsBD থেকে দ্রুত ও নিরাপদে টপআপ করুন। ${product.category} সার্ভিস।`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/topup/${product.id}/${product.slug}` },
    openGraph: {
      title: `${product.name} | TopUpsBD`,
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
    description: product.description || `${product.name} topup - TopUpsBD`,
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
            author: { "@type": "Person", name: r.user.name || "TopUpsBD Customer" },
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
    <div className="container mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <Image
          src={product.image}
          alt={product.name}
          width={64}
          height={64}
          className="h-16 w-16 rounded-lg object-cover"
        />
        <div>
          <h1 className="text-xl font-bold">{product.name}</h1>
          <p className="text-sm text-gray-500">{product.category} / Top up</p>
        </div>
      </div>

      <OrderForm
        productId={product.id}
        options={product.rechargeOptions}
        isLoggedIn={!!session?.user}
        walletBalance={walletBalance}
        stockOut={product.stockOut}
        allowGuestOrders={settings.allowGuestOrders}
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
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-bold">Rules &amp; Conditions</h2>
          <ul className="list-inside list-disc space-y-2 text-sm">
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
