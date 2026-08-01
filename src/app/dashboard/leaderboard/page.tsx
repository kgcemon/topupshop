import { auth } from "@/lib/auth";
import { getLeaderboard } from "@/lib/data";
import { formatTaka } from "@/lib/utils";
import { LevelBadge } from "@/components/level-badge";

function maskName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  const parts = trimmed.split(" ");
  const first = parts[0];
  return parts.length > 1
    ? `${first} ${parts[parts.length - 1][0]}.`
    : `${first.slice(0, 2)}${"*".repeat(Math.max(first.length - 2, 1))}`;
}

export default async function LeaderboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const { top, currentUserEntry, totalRankedCustomers } = await getLeaderboard(userId, 50);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="mb-1 text-lg font-bold">Rank & Leaderboard</h1>
        <p className="text-sm text-gray-500">
          সফল অর্ডারের সংখ্যার ভিত্তিতে টপ কাস্টমারদের র‍্যাংকিং। মোট র‍্যাংকড কাস্টমার: {totalRankedCustomers}
        </p>
      </div>

      {currentUserEntry.rank && currentUserEntry.rank > 50 && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm">
          আপনার র‍্যাংক: <span className="font-bold">#{currentUserEntry.rank}</span> · সফল অর্ডার:{" "}
          <span className="font-bold">{currentUserEntry.completedOrders}</span>
        </div>
      )}

      {top.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          এখনো কোনো র‍্যাংকড কাস্টমার নেই।
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 md:hidden">
            {top.map((entry) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  entry.isCurrentUser ? "border-primary-300 bg-primary-50" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold">
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {maskName(entry.name)}
                    {entry.isCurrentUser && <span className="ml-1 text-xs text-primary-600">(আপনি)</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <LevelBadge completedOrders={entry.completedOrders} size="sm" />
                    <span className="text-[11px] text-gray-500">{entry.completedOrders} অর্ডার</span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs font-bold text-gray-700">
                  {formatTaka(entry.totalSpent)} TK
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Level</th>
                  <th className="px-4 py-3 text-right font-semibold">সফল অর্ডার</th>
                  <th className="px-4 py-3 text-right font-semibold">মোট খরচ</th>
                </tr>
              </thead>
              <tbody>
                {top.map((entry) => (
                  <tr
                    key={entry.userId}
                    className={`border-b border-gray-50 last:border-0 ${entry.isCurrentUser ? "bg-primary-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-bold">
                      {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                    </td>
                    <td className="px-4 py-3">
                      {maskName(entry.name)}
                      {entry.isCurrentUser && <span className="ml-1 text-xs text-primary-600">(আপনি)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <LevelBadge completedOrders={entry.completedOrders} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{entry.completedOrders}</td>
                    <td className="px-4 py-3 text-right">{formatTaka(entry.totalSpent)} TK</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
