"use client";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

const AVAILABILITY_EVENT = "pwa-install-availability-change";

export function setDeferredPrompt(event: BeforeInstallPromptEvent) {
  deferredPrompt = event;
  window.dispatchEvent(new Event(AVAILABILITY_EVENT));
}

export function clearDeferredPrompt() {
  deferredPrompt = null;
  window.dispatchEvent(new Event(AVAILABILITY_EVENT));
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  clearDeferredPrompt();
  return outcome === "accepted";
}

export function subscribeInstallAvailability(callback: () => void) {
  window.addEventListener(AVAILABILITY_EVENT, callback);
  return () => window.removeEventListener(AVAILABILITY_EVENT, callback);
}

export function getInstallAvailabilitySnapshot() {
  return deferredPrompt !== null;
}

export function getInstallAvailabilityServerSnapshot() {
  return false;
}
