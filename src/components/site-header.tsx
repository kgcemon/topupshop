import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserNotifications, getUnreadNotificationCount } from "@/lib/data";
import { LogoutButton } from "@/components/logout-button";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { SiteHeaderNav } from "@/components/site-header-nav";

export async function SiteHeader() {
  const session = await auth();

  let walletBalance = 0;
  let notifications: Awaited<ReturnType<typeof getUserNotifications>> = [];
  let unreadCount = 0;
  if (session?.user) {
    const [user, notificationList, unread] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { walletBalance: true } }),
      getUserNotifications(session.user.id),
      getUnreadNotificationCount(session.user.id),
    ]);
    walletBalance = user?.walletBalance ?? 0;
    notifications = notificationList;
    unreadCount = unread;
  }

  return (
    <header className="bg-white shadow-sm sticky top-0 z-30">
      <div className="container mx-auto px-3 py-3 md:px-4">
        <nav className="flex items-center justify-between">
          <Link href="/" className="shrink-0">
            <Image
              src="/images/logo.png"
              alt="TopUpsBD Logo"
              width={192}
              height={56}
              className="w-40 md:w-48 h-auto"
            />
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            <SiteHeaderNav
              items={[
                { href: "/#topup", label: "Topup" },
                { href: "/market", label: "Market" },
                { href: "/blog", label: "Blog" },
                { href: "/contact-us", label: "Contact Us" },
                ...(session?.user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
              ]}
            />

            {session?.user && (
              <NotificationBell notifications={notifications} unreadCount={unreadCount} />
            )}
            {session?.user ? (
              <UserMenu
                name={session.user.name ?? null}
                email={session.user.email ?? null}
                image={session.user.image ?? null}
                walletBalance={walletBalance}
                isAdmin={session.user.role === "ADMIN"}
              >
                <LogoutButton className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 transition-colors" />
              </UserMenu>
            ) : (
              <Link
                href="/login"
                className="rounded border-2 border-primary-500 bg-primary-500 text-white px-5 py-2 font-bold hover:bg-primary-600 hover:border-primary-600 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
