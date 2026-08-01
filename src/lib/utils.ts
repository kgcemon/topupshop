export function formatTaka(amount: number) {
  return new Intl.NumberFormat("en-BD").format(amount);
}

export function generateOrderNumber() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `UCG-${stamp}-${random}`;
}

export function formatOrderNumber(serial: number) {
  return `#${serial}`;
}

export function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6, no DST

/**
 * UTC instant boundaries for a given Dhaka-local calendar day (0 = today,
 * 1 = yesterday, ...). Usable directly as `createdAt: { gte: start, lt: end }`
 * since MySQL DateTime columns store absolute instants.
 */
export function getDhakaDayRange(daysAgo = 0): { start: Date; end: Date } {
  const shifted = new Date(Date.now() + DHAKA_OFFSET_MS);
  const dhakaMidnightShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysAgo
  );
  const start = new Date(dhakaMidnightShifted - DHAKA_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
