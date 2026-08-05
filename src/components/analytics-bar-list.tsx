export type AnalyticsBarRow = {
  id: string;
  label: React.ReactNode;
  value: number;
  valueLabel: string;
  barColor?: string;
};

// Magnitude-only horizontal bar list — identity comes from `label` (a badge,
// icon, or plain text), never from the bar's hue, so no categorical palette
// is needed here. Works as a single stacked column on mobile.
export function AnalyticsBarList({
  title,
  rows,
  emptyText,
  defaultColor = "#0f3460",
}: {
  title: string;
  rows: AnalyticsBarRow[];
  emptyText: string;
  defaultColor?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <h3 className="mb-3 text-sm font-bold text-gray-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 truncate">{row.label}</div>
                <span className="shrink-0 font-bold text-gray-900">{row.valueLabel}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, (row.value / max) * 100)}%`,
                    backgroundColor: row.barColor ?? defaultColor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
