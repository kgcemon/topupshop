import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Market - গেম আইডি বাই/সেল",
  description: "গেম আইডি ও অ্যাকাউন্ট কেনাবেচা করুন",
};

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game } = await searchParams;
  const [session, setting] = await Promise.all([
    auth(),
    prisma.siteSetting.findUnique({ where: { id: 1 }, select: { marketEnabled: true } }),
  ]);

  if (setting && !setting.marketEnabled) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-2 text-lg font-bold">Market বর্তমানে বন্ধ আছে</h1>
        <p className="text-sm text-gray-500">এই ফিচারটি সাময়িকভাবে বন্ধ রাখা হয়েছে। পরে আবার চেষ্টা করুন।</p>
      </div>
    );
  }

  const listings = await prisma.marketListing.findMany({
    where: { status: "APPROVED", ...(game ? { game: { equals: game } } : {}) },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, game: true, price: true, images: true, createdAt: true },
  });

  const games = await prisma.marketListing.findMany({
    where: { status: "APPROVED" },
    distinct: ["game"],
    select: { game: true },
    orderBy: { game: "asc" },
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Market</h1>
          <p className="text-xs text-gray-500">অন্যান্য ইউজারদের গেম আইডি/অ্যাকাউন্ট কিনুন অথবা আপনারটি বিক্রি করুন</p>
        </div>
        <Link
          href={session?.user ? "/market/new" : "/login?callbackUrl=/market/new"}
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
        >
          + আইডি বিক্রি করুন
        </Link>
      </div>

      {games.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/market"
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              !game ? "border-primary-500 bg-primary-50 text-primary-600" : "border-gray-300 text-gray-600"
            }`}
          >
            সব
          </Link>
          {games.map((g) => (
            <Link
              key={g.game}
              href={`/market?game=${encodeURIComponent(g.game)}`}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                game === g.game ? "border-primary-500 bg-primary-50 text-primary-600" : "border-gray-300 text-gray-600"
              }`}
            >
              {g.game}
            </Link>
          ))}
        </div>
      )}

      {listings.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">এখনো কোনো লিস্টিং নেই।</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {listings.map((listing) => {
            const images = Array.isArray(listing.images) ? (listing.images as string[]) : [];
            return (
              <Link
                key={listing.id}
                href={`/market/${listing.id}`}
                className="block overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-md"
              >
                <div className="relative aspect-square w-full bg-gray-100">
                  {images[0] ? (
                    <Image src={images[0]} alt={listing.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">No Image</div>
                  )}
                </div>
                <div className="p-3">
                  <span className="mb-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                    {listing.game}
                  </span>
                  <p className="mb-1 line-clamp-2 text-sm font-semibold">{listing.title}</p>
                  <p className="text-sm font-bold text-primary-600">৳ {formatTaka(listing.price)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
