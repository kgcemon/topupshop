import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function buildNav(
  pendingOrders: number,
  pendingWalletRequests: number,
  pendingReviews: number,
  pendingMarketListings: number
) {
  return [
    { href: "/admin", label: "Dashboard", badge: 0 },
    { href: "/admin/orders", label: "Orders", badge: pendingOrders },
    { href: "/admin/wallet-requests", label: "Wallet Requests", badge: pendingWalletRequests },
    { href: "/admin/users", label: "Users", badge: 0 },
    { href: "/admin/products", label: "Products", badge: 0 },
    { href: "/admin/market", label: "Market", badge: pendingMarketListings },
    { href: "/admin/unipin", label: "Unipin", badge: 0 },
    { href: "/admin/shell", label: "Garena Shell", badge: 0 },
    { href: "/admin/api-settings", label: "API Settings", badge: 0 },
    { href: "/admin/sms-settings", label: "SMS Settings", badge: 0 },
    { href: "/admin/store-sms", label: "Store SMS", badge: 0 },
    { href: "/admin/sections", label: "Sections", badge: 0 },
    { href: "/admin/blog", label: "Blog", badge: 0 },
    { href: "/admin/banners", label: "Banners", badge: 0 },
    { href: "/admin/notices", label: "Notices", badge: 0 },
    { href: "/admin/reviews", label: "Reviews", badge: pendingReviews },
    { href: "/admin/settings", label: "Settings", badge: 0 },
  ];
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [pendingOrders, pendingWalletRequests, pendingReviews, pendingMarketListings] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.walletTransaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    prisma.review.count({ where: { isApproved: false } }),
    prisma.marketListing.count({ where: { status: "PENDING" } }),
  ]);

  const NAV = buildNav(pendingOrders, pendingWalletRequests, pendingReviews, pendingMarketListings);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <AdminNav items={NAV} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
