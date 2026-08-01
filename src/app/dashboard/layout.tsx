import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthSessionProvider } from "@/components/session-provider";
import { DashboardNav } from "@/components/dashboard-nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/deposit", label: "Deposit" },
  { href: "/dashboard/orders", label: "Order History" },
  { href: "/dashboard/leaderboard", label: "Rank & Leaderboard" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isBlocked: true, blockedUntil: true, blockReason: true },
  });
  const isCurrentlyBlocked =
    dbUser?.isBlocked && (!dbUser.blockedUntil || dbUser.blockedUntil > new Date());

  if (isCurrentlyBlocked) {
    return (
      <div className="container mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-red-600">আপনার একাউন্টটি ব্লক করা হয়েছে</h1>
        {dbUser?.blockReason && <p className="text-sm text-gray-600">কারণ: {dbUser.blockReason}</p>}
        <p className="text-sm text-gray-600">
          {dbUser?.blockedUntil
            ? `এই একাউন্টটি ${new Date(dbUser.blockedUntil).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })} পর্যন্ত ব্লক থাকবে।`
            : "এই একাউন্টটি স্থায়ীভাবে ব্লক করা হয়েছে।"}
        </p>
        <p className="text-sm text-gray-600">সহায়তার জন্য আমাদের সাপোর্টে যোগাযোগ করুন।</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-secondary-900 px-5 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            লগআউট
          </button>
        </form>
      </div>
    );
  }

  return (
    <AuthSessionProvider>
      <div className="container mx-auto px-3 py-4 md:px-4 md:py-8">
        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          <DashboardNav items={NAV} />
          <div>{children}</div>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
