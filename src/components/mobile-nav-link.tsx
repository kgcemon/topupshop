"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNavLink({
  href,
  label,
  featured = false,
  children,
}: {
  href: string;
  label: string;
  /** Raises the icon into a filled circle above the bar — for the one primary action. */
  featured?: boolean;
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
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={`relative z-[1] flex h-[50px] min-w-0 flex-col items-center justify-start gap-1 pt-px text-center transition-colors ${
        isActive ? "text-primary-600" : "text-[#5f6977] hover:text-primary-600"
      }`}
    >
      <span
        className={
          featured
            ? // Lifted clear of the bar, so it reads as the primary action rather
              // than one tab among five. The white ring is what separates the
              // circle from the bar it overlaps.
              "absolute -top-[33px] left-1/2 box-border flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-primary-500 text-white shadow-[0_-3px_10px_rgba(15,23,42,0.12)]"
            : "inline-flex h-[29px] w-[29px] items-center justify-center"
        }
      >
        {children}
      </span>
      <span
        className={`absolute inset-x-0 bottom-[5px] mx-auto truncate text-[11px] font-semibold leading-[1.05] ${
          featured ? `max-w-[82px] ${isActive ? "" : "text-slate-500"}` : "max-w-[72px]"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
