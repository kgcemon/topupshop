import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/utils";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MarketListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session, listing] = await Promise.all([
    auth(),
    prisma.marketListing.findUnique({
      where: { id },
      include: { seller: { select: { name: true, image: true } } },
    }),
  ]);

  if (!listing || listing.status !== "APPROVED") {
    notFound();
  }

  const images = Array.isArray(listing.images) ? (listing.images as string[]) : [];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        {images.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {images.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-gray-100">
                <Image src={src} alt={`${listing.title} ${i + 1}`} fill className="object-cover" unoptimized />
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

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="mb-2 text-sm font-bold">যোগাযোগ করুন</h2>
          {session?.user ? (
            <div className="space-y-1 text-sm">
              {listing.contactNumber && (
                <p>
                  <span className="font-semibold">কন্টাক্ট নাম্বারঃ</span> {listing.contactNumber}
                </p>
              )}
              {listing.whatsappNumber && (
                <p>
                  <span className="font-semibold">WhatsApp:</span> {listing.whatsappNumber}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-gray-600">বিক্রেতার কন্টাক্ট তথ্য দেখতে লগইন করুন।</p>
              <Link
                href={`/login?callbackUrl=/market/${listing.id}`}
                className="inline-block rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
              >
                লগইন করুন
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
