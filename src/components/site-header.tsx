import Link from "next/link";
import Image from "next/image";
import { getSessionWithWallet } from "@/lib/session";
import { getUserNotifications, getUnreadNotificationCount, getSiteSettings } from "@/lib/data";
import { LogoutButton } from "@/components/logout-button";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { SiteHeaderNav } from "@/components/site-header-nav";

export async function SiteHeader() {
  const { session, walletBalance } = await getSessionWithWallet();
  const settings = await getSiteSettings();

  let notifications: Awaited<ReturnType<typeof getUserNotifications>> = [];
  let unreadCount = 0;
  if (session?.user) {
    const [notificationList, unread] = await Promise.all([
      getUserNotifications(session.user.id),
      getUnreadNotificationCount(session.user.id),
    ]);
    notifications = notificationList;
    unreadCount = unread;
  }

  const isStaff = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  return (
    <header className="site-header">
      <div className="container m-auto p-2 py-3 md:px-0 md:py-5">
        <nav className="flex items-center justify-between">
          <Link href="/" className="shrink-0">
            <Image
              src={settings.logo || "/images/logo.png"}
              alt={`${settings.siteName} Logo`}
              width={192}
              height={43}
              unoptimized={!!settings.logo}
              className="h-auto max-h-[58px] w-40 object-contain md:w-48"
            />
          </Link>

          <div className="flex items-center gap-2 md:gap-4">
            <SiteHeaderNav
              items={[
                { href: "/#topup", label: "Topup" },
                { href: "/market", label: "Market" },
                { href: "/blog", label: "Blog" },
                { href: "/contact-us", label: "Contact Us" },
                ...(isStaff ? [{ href: "/admin", label: "Admin" }] : []),
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
                isAdmin={isStaff}
                depositEnabled={settings.depositEnabled}
              >
                <LogoutButton className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 transition-colors" />
              </UserMenu>
            ) : (
              <Link
                href="/login"
                className="rounded-md border-2 border-primary-500 bg-primary-500 px-5 py-2 font-bold text-white transition-colors hover:border-primary-600 hover:bg-primary-600"
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
