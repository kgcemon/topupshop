import { getLevelProgress } from "@/lib/levels";

export function LevelBadge({ completedOrders, size = "md" }: { completedOrders: number; size?: "sm" | "md" }) {
  const { current } = getLevelProgress(completedOrders);
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold ${current.badgeClass} ${sizeClass}`}>
      {current.labelBn}
    </span>
  );
}
