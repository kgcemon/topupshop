"use client";

import { useSyncExternalStore } from "react";
import {
  getInstallAvailabilitySnapshot,
  getInstallAvailabilityServerSnapshot,
  subscribeInstallAvailability,
  promptInstall,
} from "@/lib/pwa-install";

const STORAGE_KEY = "installAppDismissed";

function subscribe(callback: () => void) {
  window.addEventListener("install-app-dismissed", callback);
  return () => window.removeEventListener("install-app-dismissed", callback);
}

function getSnapshot() {
  return sessionStorage.getItem(STORAGE_KEY) !== "1";
}

function getServerSnapshot() {
  return false;
}

function dismiss() {
  sessionStorage.setItem(STORAGE_KEY, "1");
  window.dispatchEvent(new Event("install-app-dismissed"));
}

export function InstallAppPopup() {
  const notDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const canInstall = useSyncExternalStore(
    subscribeInstallAvailability,
    getInstallAvailabilitySnapshot,
    getInstallAvailabilityServerSnapshot
  );

  if (!notDismissed || !canInstall) return null;

  async function handleInstall() {
    await promptInstall();
    dismiss();
  }

  return (
    <div className="fixed inset-x-3 bottom-36 z-40 flex items-center gap-3 rounded-xl bg-primary-500 p-3 text-white shadow-lg md:inset-x-auto md:right-5 md:bottom-24 md:w-80">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M12 16l4-5h-3V4h-2v7H8l4 5zm-7 2h14v2H5v-2z" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">Install App</p>
        <p className="truncate text-xs text-white/80">দ্রুত ও ভালো অভিজ্ঞতার জন্য</p>
      </div>

      <button
        onClick={handleInstall}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-primary-600"
      >
        Install
      </button>

      <button
        aria-label="বন্ধ করুন"
        onClick={dismiss}
        className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
