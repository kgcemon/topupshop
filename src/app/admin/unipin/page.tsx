import { prisma } from "@/lib/prisma";
import { getDhakaDayRange } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { addUnipinCodesAction, deleteUnipinCodeAction } from "@/lib/actions/unipin-actions";

export default async function AdminUnipinPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; skipped?: string }>;
}) {
  const { added, skipped } = await searchParams;
  const today = getDhakaDayRange(0);

  const [optionsWithDenom, statusCounts, usedTodayCounts, unusedCodes] = await Promise.all([
    prisma.rechargeOption.findMany({
      where: { denom: { not: null } },
      select: { denom: true, label: true, product: { select: { name: true } } },
    }),
    prisma.unipinCode.groupBy({ by: ["denom", "status"], _count: { _all: true } }),
    prisma.unipinCode.groupBy({
      by: ["denom"],
      where: { status: "USED", usedAt: { gte: today.start, lt: today.end } },
      _count: { _all: true },
    }),
    prisma.unipinCode.findMany({
      where: { status: "UNUSED" },
      orderBy: [{ denom: "asc" }, { createdAt: "asc" }],
      select: { id: true, code: true, denom: true, createdAt: true },
      take: 1000,
    }),
  ]);

  // Every denom token referenced by any product's recipe, plus any denom that
  // already has codes stocked (covers pre-stocking ahead of wiring a product).
  const usageByDenom = new Map<string, string[]>();
  for (const option of optionsWithDenom) {
    const tokens = (option.denom ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const list = usageByDenom.get(token) ?? [];
      list.push(`${option.product.name} — ${option.label}`);
      usageByDenom.set(token, list);
    }
  }

  type Stat = { total: number; unused: number; used: number; usedToday: number };
  const stats = new Map<string, Stat>();
  const ensure = (denom: string) => {
    let s = stats.get(denom);
    if (!s) {
      s = { total: 0, unused: 0, used: 0, usedToday: 0 };
      stats.set(denom, s);
    }
    return s;
  };
  for (const row of statusCounts) {
    const s = ensure(row.denom);
    s.total += row._count._all;
    if (row.status === "UNUSED") s.unused += row._count._all;
    if (row.status === "USED") s.used += row._count._all;
    if (!usageByDenom.has(row.denom)) usageByDenom.set(row.denom, []);
  }
  for (const row of usedTodayCounts) {
    ensure(row.denom).usedToday = row._count._all;
  }

  const codesByDenom = new Map<string, typeof unusedCodes>();
  for (const code of unusedCodes) {
    const list = codesByDenom.get(code.denom) ?? [];
    list.push(code);
    codesByDenom.set(code.denom, list);
  }

  const denoms = [...usageByDenom.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const overall = { total: 0, unused: 0, used: 0, usedToday: 0 };
  for (const s of stats.values()) {
    overall.total += s.total;
    overall.unused += s.unused;
    overall.used += s.used;
    overall.usedToday += s.usedToday;
  }

  const overviewCards = [
    { label: "Total Codes", value: overall.total },
    { label: "Unused", value: overall.unused },
    { label: "Used (Total)", value: overall.used },
    { label: "Used Today", value: overall.usedToday },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h1 className="mb-3 text-lg font-bold">Unipin কোড ম্যানেজমেন্ট</h1>

        {added !== undefined && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
            {added} টি কোড যোগ হয়েছে
            {Number(skipped) > 0 ? ` · ${skipped} টি ডুপ্লিকেট বাদ দেওয়া হয়েছে` : ""}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overviewCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-gray-200 p-3">
              <p className="text-[11px] text-gray-500">{card.label}</p>
              <p className="mt-0.5 text-xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h2 className="mb-3 text-sm font-bold text-gray-700">নতুন / অন্য Denom-এ কোড যোগ করুন</h2>
        <form action={addUnipinCodesAction} className="space-y-2">
          <input
            type="text"
            name="denom"
            required
            placeholder="Denom (e.g. 4)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-xs"
          />
          <textarea
            name="codes"
            rows={3}
            placeholder="একটি লাইনে একটি কোড লিখুন..."
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-secondary-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 sm:w-auto"
          >
            + কোড যোগ করুন
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <h2 className="mb-2 text-sm font-bold text-gray-700">Denom পুল</h2>
        {denoms.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            কোনো denom পুল নেই।
          </p>
        )}
        <div className="space-y-2">
          {denoms.map((denom) => {
            const s = stats.get(denom) ?? { total: 0, unused: 0, used: 0, usedToday: 0 };
            const codes = codesByDenom.get(denom) ?? [];
            const usage = usageByDenom.get(denom) ?? [];
            return (
              <details
                key={denom}
                id={`denom-${denom}`}
                className="group rounded-lg border border-gray-200 open:border-primary-300"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">Denom: {denom}</p>
                    <p className="truncate text-[11px] text-gray-500">
                      {usage.length > 0 ? usage.join(" · ") : "কোনো প্রোডাক্টে ব্যবহৃত হচ্ছে না"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.unused > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.unused} unused
                    </span>
                    <span className="hidden rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 sm:inline">
                      {s.usedToday} today
                    </span>
                    <svg
                      className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </summary>

                <div className="space-y-3 border-t border-gray-100 p-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-gray-50 py-1.5">
                      <p className="text-sm font-bold">{s.total}</p>
                      <p className="text-[10px] text-gray-500">Total</p>
                    </div>
                    <div className="rounded-md bg-gray-50 py-1.5">
                      <p className="text-sm font-bold">{s.used}</p>
                      <p className="text-[10px] text-gray-500">Used</p>
                    </div>
                    <div className="rounded-md bg-gray-50 py-1.5">
                      <p className="text-sm font-bold">{s.usedToday}</p>
                      <p className="text-[10px] text-gray-500">Used Today</p>
                    </div>
                  </div>

                  <form action={addUnipinCodesAction} className="space-y-2">
                    <input type="hidden" name="denom" value={denom} />
                    <textarea
                      name="codes"
                      rows={3}
                      placeholder="একটি লাইনে একটি কোড লিখুন..."
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-secondary-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 sm:w-auto"
                    >
                      + কোড যোগ করুন
                    </button>
                  </form>

                  <div>
                    <p className="mb-1.5 text-[11px] font-bold text-gray-500">
                      Unused কোড ({s.unused})
                    </p>
                    {codes.length === 0 ? (
                      <p className="rounded-md border border-dashed border-gray-300 py-4 text-center text-[11px] text-gray-400">
                        কোনো unused কোড নেই।
                      </p>
                    ) : (
                      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                        {codes.map((code) => (
                          <div
                            key={code.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5"
                          >
                            <span className="truncate font-mono text-xs">{code.code}</span>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <CopyButton value={code.code} label="" />
                              <form action={deleteUnipinCodeAction}>
                                <input type="hidden" name="codeId" value={code.id} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
