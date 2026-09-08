"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatTaka } from "@/lib/utils";

export function UserMenu({
  name,
  email,
  image,
  walletBalance,
  isAdmin,
  depositEnabled,
  children,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
  walletBalance: number;
  isAdmin: boolean;
  depositEnabled: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = (name || email || "U").trim().charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border-2 border-gray-200 py-1 pl-1 pr-2.5 hover:border-primary-500 transition-colors"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "Profile"}
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-900 text-sm font-bold text-white">
            {initial}
          </span>
        )}
        <span className="text-xs font-extrabold whitespace-nowrap text-secondary-900 sm:text-sm">
          ৳ {formatTaka(walletBalance)}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-gray-900">{name || "User"}</p>
            <p className="truncate text-xs text-gray-500">{email}</p>
          </div>

          <div className="mx-3 mt-3 flex items-center justify-between rounded-lg border border-primary-100 bg-primary-50 px-3 py-2">
            <span className="text-xs font-bold text-gray-600">Wallet Balance</span>
            <span className="text-sm font-extrabold text-primary-700">৳ {formatTaka(walletBalance)}</span>
          </div>

          <div className="p-2">
            <MenuLink href="/dashboard" onNavigate={() => setOpen(false)}>
              Dashboard
            </MenuLink>
            <MenuLink href="/dashboard/profile" onNavigate={() => setOpen(false)}>
              Profile
            </MenuLink>
            {depositEnabled && (
              <MenuLink href="/dashboard/deposit" onNavigate={() => setOpen(false)}>
                টাকা যোগ করুন
              </MenuLink>
            )}
            {isAdmin && (
              <MenuLink href="/admin" onNavigate={() => setOpen(false)}>
                Admin Panel
              </MenuLink>
            )}
          </div>

          <div className="border-t border-gray-100 p-2">{children}</div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}
