import Image from "next/image";
import { formatTaka } from "@/lib/utils";

// Shared pieces of the EPS "Auto Pay" method, used by the topup checkout and
// the wallet deposit form.

type Icons = { bkashIcon: string | null; nagadIcon: string | null; rocketIcon: string | null };

const WALLETS = [
  { key: "bkashIcon", label: "bKash", color: "#E2136E" },
  { key: "nagadIcon", label: "Nagad", color: "#F42534" },
  { key: "rocketIcon", label: "Rocket", color: "#8C3494" },
] as const;

function WalletBadge({ src, label, color, size }: { src: string | null; label: string; color: string; size: number }) {
  return src ? (
    <Image
      src={src}
      alt={label}
      width={size}
      height={size}
      unoptimized
      className="rounded-full bg-white object-cover ring-2 ring-white"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
      aria-label={label}
    >
      {label.charAt(0)}
    </span>
  );
}

/**
 * The admin's uploaded Auto Pay image (or the bundled bKash / Nagad / Rocket
 * strip) with a lightning bolt — reads as "pay any of these, instantly".
 */
export function AutoPayIcon({ src }: { src?: string | null }) {
  return (
    <span className="relative flex h-full w-full items-center justify-center">
      <Image
        src={src || "/images/auto-pay-icon.jpg"}
        alt="bKash, Nagad, Rocket"
        width={708}
        height={212}
        unoptimized
        className="h-auto max-h-full w-full object-contain"
      />
      <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm ring-2 ring-white">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      </span>
    </span>
  );
}

export function WalletRow({ icons }: { icons: Icons }) {
  return (
    <span className="flex items-center gap-1.5">
      {WALLETS.map((w) => (
        <span key={w.key} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-gray-700">
          <WalletBadge src={icons[w.key]} label={w.label} color={w.color} size={16} />
          {w.label}
        </span>
      ))}
    </span>
  );
}

export function AutoPayNotice({ subtitle, className = "" }: { subtitle: string | null; className?: string }) {
  return (
    <div className={`rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4 shrink-0" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
        </svg>
        {subtitle || "bKash, Nagad, Rocket দিয়ে অটো পেমেন্ট"}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-emerald-900/80">
        <li>• ট্রানজেকশন আইডি দিতে হবে না</li>
        <li>• নিরাপদ পেমেন্ট পেজে নিয়ে যাওয়া হবে</li>
        <li>• পেমেন্ট সফল হলেই সাথে সাথে কনফার্ম</li>
      </ul>
    </div>
  );
}

export function EpsRedirectOverlay({ amount }: { amount?: number }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
      <span className="relative mb-4 flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/20" />
        <svg className="h-10 w-10 animate-spin text-primary-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
        </svg>
      </span>
      <p className="text-base font-bold text-secondary-900">পেমেন্ট পেজে নিয়ে যাওয়া হচ্ছে...</p>
      {amount ? <p className="mt-1 text-sm text-gray-500">পরিশোধ করবেন ৳{formatTaka(amount)}</p> : null}
      <p className="mt-3 max-w-xs text-xs text-gray-400">পেজটি বন্ধ করবেন না। পেমেন্ট শেষে আপনাকে স্বয়ংক্রিয়ভাবে ফিরিয়ে আনা হবে।</p>
    </div>
  );
}
