"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import {
  getInstallAvailabilitySnapshot,
  getInstallAvailabilityServerSnapshot,
  subscribeInstallAvailability,
  promptInstall,
} from "@/lib/pwa-install";

export function DownloadAppButton() {
  const canInstall = useSyncExternalStore(
    subscribeInstallAvailability,
    getInstallAvailabilitySnapshot,
    getInstallAvailabilityServerSnapshot
  );

  async function handleClick() {
    if (canInstall) {
      await promptInstall();
      return;
    }
    window.alert('অ্যাপ ইনস্টল করতে ব্রাউজার মেনু থেকে "Add to Home Screen" অপশনটি নির্বাচন করুন।');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-1 items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-2.5 py-1.5 transition-shadow hover:shadow-md sm:flex-none sm:gap-3 sm:px-4 sm:py-2"
    >
      <Image
        src="/images/app_link.png"
        alt="Install App"
        width={32}
        height={32}
        className="h-6 w-6 shrink-0 object-contain sm:h-8 sm:w-8"
      />
      <span className="text-[11px] font-bold leading-tight sm:text-sm">
        Download Our Mobile App
        <br />
        <span className="text-primary-600">Click Here &rarr;</span>
      </span>
    </button>
  );
}
