export type LevelInfo = {
  name: string;
  labelBn: string;
  minOrders: number;
  badgeClass: string;
};

// Free Fire র‍্যাংক থিমে সাজানো — সাকসেসফুল (APPROVED/RUNNING/DELIVERED) অর্ডারের সংখ্যার ভিত্তিতে লেভেল ধাপে ধাপে বাড়বে।
export const LEVELS: LevelInfo[] = [
  { name: "Bronze", labelBn: "ব্রোঞ্জ", minOrders: 0, badgeClass: "bg-amber-100 text-amber-800 border-amber-300" },
  { name: "Silver", labelBn: "সিলভার", minOrders: 3, badgeClass: "bg-gray-200 text-gray-700 border-gray-400" },
  { name: "Gold", labelBn: "গোল্ড", minOrders: 7, badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-400" },
  { name: "Platinum", labelBn: "প্লাটিনাম", minOrders: 15, badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-400" },
  { name: "Diamond", labelBn: "ডায়মন্ড", minOrders: 30, badgeClass: "bg-blue-100 text-blue-800 border-blue-400" },
  { name: "Heroic", labelBn: "হিরোইক", minOrders: 50, badgeClass: "bg-purple-100 text-purple-800 border-purple-400" },
  { name: "Grandmaster", labelBn: "গ্র‍্যান্ডমাস্টার", minOrders: 100, badgeClass: "bg-red-100 text-red-800 border-red-400" },
];

export const ORDER_COUNT_STATUSES = ["APPROVED", "RUNNING", "DELIVERED"] as const;

export function getLevelProgress(completedOrders: number) {
  let currentIndex = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (completedOrders >= LEVELS[i].minOrders) currentIndex = i;
  }

  const current = LEVELS[currentIndex];
  const next = LEVELS[currentIndex + 1] ?? null;

  const ordersToNext = next ? Math.max(next.minOrders - completedOrders, 0) : 0;
  const progressPercent = next
    ? Math.min(
        100,
        Math.round(
          ((completedOrders - current.minOrders) / (next.minOrders - current.minOrders)) * 100
        )
      )
    : 100;

  return { current, next, ordersToNext, progressPercent };
}
