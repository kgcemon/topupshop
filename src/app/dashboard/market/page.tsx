import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/utils";
import { deleteOwnMarketListingAction, markOwnListingSoldAction } from "@/lib/actions/market-actions";

export const metadata: Metadata = {
  title: "আমার মার্কেট লিস্টিং",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Live", className: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
  SOLD: { label: "Sold", className: "bg-gray-200 text-gray-600" },
};

export default async function MyMarketListingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/market");
  }

  const listings = await prisma.marketListing.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <h1 className="mb-1 text-lg font-bold">আমার মার্কেট লিস্টিং</h1>
          <p className="text-xs text-gray-500">আপনার পোস্ট করা গেম আইডি/অ্যাকাউন্ট লিস্টিং এখানে দেখুন</p>
        </div>
        <Link
          href="/market/new"
          className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
        >
          + নতুন পোস্ট
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
          আপনি এখনো কোনো লিস্টিং পোস্ট করেননি।
        </p>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const status = STATUS_LABELS[listing.status];
            return (
              <div key={listing.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(listing.createdAt).toLocaleDateString("bn-BD", { dateStyle: "medium" })}
                  </span>
                </div>
                <p className="mb-1 text-sm font-bold">{listing.title}</p>
                <p className="mb-2 text-sm text-primary-600">
                  {listing.game} &middot; ৳ {formatTaka(listing.price)}
                </p>
                {listing.status === "REJECTED" && listing.adminNote && (
                  <p className="mb-2 text-xs text-red-600">কারণঃ {listing.adminNote}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {listing.status === "APPROVED" && (
                    <Link
                      href={`/market/${listing.id}`}
                      target="_blank"
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50"
                    >
                      দেখুন
                    </Link>
                  )}
                  {listing.status === "APPROVED" && (
                    <form action={markOwnListingSoldAction}>
                      <input type="hidden" name="id" value={listing.id} />
                      <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50">
                        Sold হিসেবে মার্ক করুন
                      </button>
                    </form>
                  )}
                  <form action={deleteOwnMarketListingAction}>
                    <input type="hidden" name="id" value={listing.id} />
                    <button className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
