import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MarketListingForm } from "@/components/market-listing-form";

export const metadata: Metadata = {
  title: "আইডি বিক্রি করুন - Market",
  robots: { index: false, follow: false },
};

export default async function NewMarketListingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/market/new");
  }

  const setting = await prisma.siteSetting.findUnique({ where: { id: 1 }, select: { marketEnabled: true } });
  if (setting && !setting.marketEnabled) {
    redirect("/market");
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-1 text-lg font-bold">আপনার গেম আইডি বিক্রি করুন</h1>
        <p className="mb-4 text-xs text-gray-500">সঠিক তথ্য দিয়ে পোস্ট করুন, ভুয়া তথ্যযুক্ত পোস্ট বাতিল করা হবে।</p>
        <MarketListingForm />
      </div>
    </div>
  );
}
