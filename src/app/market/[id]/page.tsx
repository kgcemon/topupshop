import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/data";
import { formatTaka } from "@/lib/utils";
import { WhatsappBargainLink, WhatsAppIcon } from "@/components/whatsapp-bargain-link";
import { MarketOfferForm } from "@/components/market-offer-form";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const OFFER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "রিভিউ হচ্ছে", className: "bg-yellow-100 text-yellow-700" },
  ACCEPTED: { label: "গৃহীত হয়েছে", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "প্রত্যাখ্যাত", className: "bg-red-100 text-red-700" },
};

export default async function MarketListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session, settings, listing] = await Promise.all([
    auth(),
    getSiteSettings(),
    prisma.marketListing.findUnique({
      where: { id },
      include: { seller: { select: { name: true, image: true } } },
    }),
  ]);

  if (!listing || listing.status !== "APPROVED") {
    notFound();
  }

  const myOffers = session?.user
    ? await prisma.marketOffer.findMany({
        where: { listingId: listing.id, buyerId: session.user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const images = Array.isArray(listing.images) ? (listing.images as string[]) : [];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        {images.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-gray-100">
                <Image
                  src={src}
                  alt={`${listing.title} ${i + 1}`}
                  fill
                  sizes="(min-width: 640px) 220px, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <span className="mb-2 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
          {listing.game}
        </span>
        <h1 className="mb-1 text-lg font-bold">{listing.title}</h1>
        <p className="mb-4 text-xl font-bold text-primary-600">৳ {formatTaka(listing.price)}</p>

        <p className="mb-4 whitespace-pre-line text-sm text-gray-700">{listing.description}</p>

        <p className="mb-4 text-xs text-gray-500">বিক্রেতাঃ {listing.seller.name || "User"}</p>

        <div className="mb-4">
          <h2 className="mb-2 text-sm font-bold">দাম নিয়ে বার্গেইন করুন</h2>
          {myOffers.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {myOffers.map((offer) => {
                const s = OFFER_STATUS_LABELS[offer.status];
                return (
                  <div
                    key={offer.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span>
                      আপনার অফারঃ <span className="font-bold">৳ {formatTaka(offer.offerPrice)}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.className}`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {session?.user ? (
            listing.sellerId === session.user.id ? (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                এটি আপনার নিজের লিস্টিং — নিজের লিস্টিংয়ে অফার করা যাবে না।
              </p>
            ) : (
              <MarketOfferForm listingId={listing.id} />
            )
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm text-gray-600">অফার পাঠাতে লগইন করুন।</p>
              <Link
                href={`/login?callbackUrl=/market/${listing.id}`}
                className="inline-block rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
              >
                লগইন করুন
              </Link>
            </div>
          )}
        </div>

        <WhatsappBargainLink
          whatsappNumber={settings.whatsappNumber}
          message={`আসসালামু আলাইকুম, আমি এই লিস্টিংটি কিনতে/দামাদামি করতে চাই: "${listing.title}" (${listing.game}) — মূল্য ৳${formatTaka(listing.price)}। Listing ID: ${listing.id}`}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 py-2.5 text-center text-sm font-bold text-white hover:bg-green-700"
        >
          <WhatsAppIcon />
          তাড়াতাড়ি যোগাযোগ করতে WhatsApp করুন
        </WhatsappBargainLink>
        <p className="mt-2 text-center text-xs text-gray-500">
          বিক্রেতার সাথে সরাসরি নয় — আমাদের টিম আপনার হয়ে দামাদামি করে ডিল ফাইনাল করবে।
        </p>
      </div>
    </div>
  );
}
