"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function SiteHeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm">
      {items.map((item) => {
        const isAnchorLink = item.href.includes("#");
        const isActive = !isAnchorLink && pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-block font-bold mx-2 p-1 rounded-lg ${
              isActive ? "text-primary-600" : "hover:text-primary-600"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
