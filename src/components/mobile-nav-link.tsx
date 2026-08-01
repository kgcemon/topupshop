"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Anchor links (e.g. "/#topup") point at a scroll position on the home page,
  // not a distinct route, so there's no server-known "active" state for them.
  const isAnchorLink = href.includes("#");
  const isActive = !isAnchorLink && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${
        isActive ? "text-primary-600" : "text-gray-500 hover:text-primary-600"
      }`}
    >
      {children}
      <span className="max-w-full truncate px-1">{label}</span>
    </Link>
  );
}
