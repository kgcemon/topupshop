import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProductById, getSiteSettings } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { OrderForm } from "@/components/order-form";

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
    `${product.name} - Uc Ghor থেকে দ্রুত ও নিরাপদে টপআপ করুন। ${product.category} সার্ভিস।`;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/topup/${product.id}/${product.slug}` },
    openGraph: {
      title: `${product.name} | Uc Ghor`,
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

  const [session, settings] = await Promise.all([auth(), getSiteSettings()]);

  let walletBalance = 0;
  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletBalance: true },
    });
    walletBalance = user?.walletBalance ?? 0;
  }

  const rules = Array.isArray(product.rules) ? (product.rules as string[]) : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image,
    description: product.description || `${product.name} topup - Uc Ghor`,
    category: product.category,
    offers: product.rechargeOptions.map((option) => ({
      "@type": "Offer",
      name: option.label,
      price: option.price,
      priceCurrency: "BDT",
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
    </div>
  );
}
