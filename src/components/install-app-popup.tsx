"use client";

import { useSyncExternalStore } from "react";

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
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!visible) return null;

  return (
    <div className="fixed right-4 bottom-36 z-40 max-w-[300px] rounded-lg bg-primary-500 p-4 text-white shadow-lg md:bottom-24">
      <div className="mb-1 flex items-center justify-between">
        <p className="font-bold">Install App</p>
        <button aria-label="বন্ধ করুন" onClick={dismiss}>
          ✕
        </button>
      </div>
      <p className="mb-3 text-sm">Install our app for a better experience</p>
      <button
        onClick={dismiss}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-primary-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M12 16l4-5h-3V4h-2v7H8l4 5zm-7 2h14v2H5v-2z" />
        </svg>
        Install Now
      </button>
    </div>
  );
}
