"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-semibold md:whitespace-normal ${
              isActive
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-gray-200 bg-white hover:border-primary-500 hover:text-primary-600"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
