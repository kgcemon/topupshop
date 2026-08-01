import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/utils";
import {
  approveMarketListingAction,
  rejectMarketListingAction,
  deleteMarketListingAction,
  toggleMarketEnabledAction,
} from "@/lib/actions/market-actions";

type ListingRow = {
  id: string;
  title: string;
  game: string;
  price: number;
  description: string;
  images: unknown;
  status: string;
  contactNumber: string | null;
  whatsappNumber: string | null;
  createdAt: Date;
  seller: { name: string | null; email: string };
};

function ListingRow({ listing }: { listing: ListingRow }) {
  const images = Array.isArray(listing.images) ? (listing.images as string[]) : [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{listing.title}</p>
          <p className="text-xs text-gray-500">
            {listing.game} &middot; ৳ {formatTaka(listing.price)}
          </p>
          <p className="text-xs text-gray-400">
            {listing.seller.name || "User"} ({listing.seller.email})
          </p>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(listing.createdAt).toLocaleDateString("bn-BD", { dateStyle: "medium" })}
        </span>
      </div>

      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((src, i) => (
            <Image
              key={i}
              src={src}
              alt="Screenshot"
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-md border border-gray-200 object-cover"
            />
          ))}
        </div>
      )}

      <p className="mb-2 text-sm text-gray-700">{listing.description}</p>
      <p className="mb-3 text-xs text-gray-500">
        {listing.contactNumber && <>Contact: {listing.contactNumber} </>}
        {listing.whatsappNumber && <>WhatsApp: {listing.whatsappNumber}</>}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {listing.status === "PENDING" && (
          <>
            <form action={approveMarketListingAction}>
              <input type="hidden" name="id" value={listing.id} />
              <button className="rounded-md bg-primary-500 px-3 py-1 text-xs font-bold text-white hover:bg-primary-600">
                Approve
              </button>
            </form>
            <form action={rejectMarketListingAction}>
              <input type="hidden" name="id" value={listing.id} />
              <button className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                Reject
              </button>
            </form>
          </>
        )}
        <form action={deleteMarketListingAction}>
          <input type="hidden" name="id" value={listing.id} />
          <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function AdminMarketPage() {
  const [setting, listings] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { id: 1 }, select: { marketEnabled: true } }),
    prisma.marketListing.findMany({
      orderBy: { createdAt: "desc" },
      include: { seller: { select: { name: true, email: true } } },
    }),
  ]);

  const marketEnabled = setting?.marketEnabled ?? true;
  const pending = listings.filter((l) => l.status === "PENDING");
  const approved = listings.filter((l) => l.status === "APPROVED");
  const rejected = listings.filter((l) => l.status === "REJECTED");
  const sold = listings.filter((l) => l.status === "SOLD");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-1 text-lg font-bold">Market</h1>
            <p className="text-xs text-gray-500">
              কাস্টমাররা এখানে তাদের গেম আইডি/অ্যাকাউন্ট বিক্রির জন্য পোস্ট করে। নতুন পোস্ট অ্যাডমিন অনুমোদনের পর পাবলিকভাবে দেখাবে।
            </p>
          </div>
          <form action={toggleMarketEnabledAction}>
            <input type="hidden" name="enabled" value={String(marketEnabled)} />
            <button
              className={`rounded-md px-4 py-2 text-sm font-bold text-white ${
                marketEnabled ? "bg-red-500 hover:bg-red-600" : "bg-primary-500 hover:bg-primary-600"
              }`}
            >
              {marketEnabled ? "Market বন্ধ করুন" : "Market চালু করুন"}
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs font-semibold">
          বর্তমান অবস্থাঃ{" "}
          <span className={marketEnabled ? "text-green-600" : "text-red-600"}>
            {marketEnabled ? "চালু" : "বন্ধ"}
          </span>
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">কোনো পেন্ডিং লিস্টিং নেই।</p>
        ) : (
          <div className="space-y-3">
            {pending.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">Approved ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-gray-400">কোনো অনুমোদিত লিস্টিং নেই।</p>
        ) : (
          <div className="space-y-3">
            {approved.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">Sold ({sold.length})</h2>
        {sold.length === 0 ? (
          <p className="text-sm text-gray-400">কোনো বিক্রিত লিস্টিং নেই।</p>
        ) : (
          <div className="space-y-3">
            {sold.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-gray-500">Rejected ({rejected.length})</h2>
        {rejected.length === 0 ? (
          <p className="text-sm text-gray-400">কোনো বাতিল লিস্টিং নেই।</p>
        ) : (
          <div className="space-y-3">
            {rejected.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
