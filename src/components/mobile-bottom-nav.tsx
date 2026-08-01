import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTaka } from "@/lib/utils";
import { MobileNavLink as NavLink } from "@/components/mobile-nav-link";

export async function MobileBottomNav() {
  const session = await auth();

  let walletBalance: number | null = null;
  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletBalance: true },
    });
    walletBalance = user?.walletBalance ?? 0;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)] md:hidden"
      aria-label="Mobile navigation"
    >
      <NavLink href="/" label="Home">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="m3 9 9-7 9 7v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
        </svg>
      </NavLink>

      <NavLink href="/market" label="Market">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
        </svg>
      </NavLink>

      {session?.user ? (
        <>
          <NavLink href="/dashboard/deposit" label={`৳ ${formatTaka(walletBalance ?? 0)}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2M18 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z" />
            </svg>
          </NavLink>

          <NavLink href="/dashboard/orders" label="Orders">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1Z" />
              <path d="M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1Z" />
              <path d="M9 11h6M9 15h6" />
            </svg>
          </NavLink>

          <NavLink href="/dashboard/profile" label="Profile">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6" />
            </svg>
          </NavLink>
        </>
      ) : (
        <>
          <NavLink href="/contact-us" label="Contact">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </NavLink>

          <NavLink href="/login" label="Login">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5M15 12H3" />
            </svg>
          </NavLink>
        </>
      )}
    </nav>
  );
}
