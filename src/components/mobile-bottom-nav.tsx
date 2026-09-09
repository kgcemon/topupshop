import { getSessionWithWallet } from "@/lib/session";
import { getSiteSettings } from "@/lib/data";
import { MobileNavLink as NavLink } from "@/components/mobile-nav-link";

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" {...stroke} strokeWidth="2">
      <path d="M3.75 10.4 12 3.7l8.25 6.7v8.1a2 2 0 0 1-2 2h-3.1v-5.9h-6.3v5.9h-3.1a2 2 0 0 1-2-2v-8.1Z" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" {...stroke} strokeWidth="2">
      <path d="M5 7.5h14v12H5v-12Z" />
      <path d="M8 7.5V5.8A2.8 2.8 0 0 1 10.8 3h2.4A2.8 2.8 0 0 1 16 5.8v1.7M5 11h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[31px] w-[31px]" {...stroke} strokeWidth="3.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" {...stroke} strokeWidth="2">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" {...stroke} strokeWidth="2">
      <path d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.75 20.1a7.25 7.25 0 0 1 14.5 0" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" {...stroke} strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full" {...stroke} strokeWidth="2">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

export async function MobileBottomNav() {
  const [{ session }, settings] = await Promise.all([getSessionWithWallet(), getSiteSettings()]);

  const isLoggedIn = !!session?.user;
  // Add Money sits in the middle so the raised circle lands at the centre of the
  // bar; drop it entirely when deposits are switched off (see depositEnabled).
  const showAddMoney = isLoggedIn && settings.depositEnabled;

  const items = isLoggedIn
    ? [
        { href: "/", label: "Home", icon: <HomeIcon /> },
        { href: "/dashboard/orders", label: "My Orders", icon: <OrdersIcon /> },
        ...(showAddMoney
          ? [{ href: "/dashboard/deposit", label: "Add Money", icon: <PlusIcon />, featured: true }]
          : []),
        { href: "/market", label: "Market", icon: <MarketIcon /> },
        { href: "/dashboard/profile", label: "My Account", icon: <AccountIcon /> },
      ]
    : [
        { href: "/", label: "Home", icon: <HomeIcon /> },
        { href: "/market", label: "Market", icon: <MarketIcon /> },
        { href: "/contact-us", label: "Contact", icon: <ContactIcon /> },
        { href: "/login", label: "Login", icon: <LoginIcon /> },
      ];

  return (
    // The featured circle overflows above the bar, so the nav itself must not
    // swallow taps in that strip — only the shell takes pointer events.
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className={`pointer-events-auto relative grid items-end overflow-visible rounded-t-xl border-t border-[rgba(203,213,225,0.98)] bg-white pt-[5px] pb-[calc(4px+env(safe-area-inset-bottom))] shadow-[0_-6px_16px_rgba(15,23,42,0.08)] ${
          showAddMoney ? "min-h-[66px]" : "min-h-[60px]"
        }`}
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} featured={"featured" in item}>
            {item.icon}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
