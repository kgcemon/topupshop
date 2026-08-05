import type { AdviceItem } from "@/lib/analytics";

const LEVEL_STYLES: Record<AdviceItem["level"], { wrap: string; tag: string; tagText: string; icon: string }> = {
  critical: { wrap: "border-red-200 bg-red-50", tag: "bg-red-600", tagText: "জরুরি", icon: "⚠" },
  warning: { wrap: "border-amber-200 bg-amber-50", tag: "bg-amber-500", tagText: "সতর্কতা", icon: "!" },
  good: { wrap: "border-green-200 bg-green-50", tag: "bg-green-600", tagText: "ভালো", icon: "✓" },
};

export function AnalyticsAdvicePanel({ advice }: { advice: AdviceItem[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-700">পারফরম্যান্স পরামর্শ</h3>
      <div className="space-y-2">
        {advice.map((item, i) => {
          const style = LEVEL_STYLES[item.level];
          return (
            <div key={i} className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${style.wrap}`}>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${style.tag}`}
                aria-hidden
              >
                {style.icon}
              </span>
              <div className="min-w-0">
                <span className="mr-1.5 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                  {style.tagText}
                </span>
                <span className="text-gray-700">{item.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
