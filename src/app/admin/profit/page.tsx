import Link from "next/link";
import { getProfitData } from "@/lib/profit";
import { formatTaka } from "@/lib/utils";
import { setUnipinDenomCostAction, backfillOrderCostsAction } from "@/lib/actions/profit-actions";

function signedTaka(value: number) {
  return `${value < 0 ? "−" : ""}৳ ${formatTaka(Math.abs(value))}`;
}

export default async function AdminProfitPage() {
  const data = await getProfitData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">লাভ (Profit)</h1>
        <p className="mt-1 text-xs text-gray-500">
          শুধু ডেলিভারড অর্ডার ধরা হয় (ওয়ালেট, ম্যানুয়াল ও Auto Pay সব)। লাভ = বিক্রি − কেনা দাম, প্রতিটি অর্ডারের
          কেনা দাম অর্ডার তৈরির সময়ের রেট অনুযায়ী সংরক্ষিত থাকে। দিন হিসাব হয় বাংলাদেশ সময়ে, অর্ডারের তারিখ অনুযায়ী।
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.periods.map((p) => (
          <div key={p.key} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-gray-700">{p.label}</p>
              <p className="truncate text-[11px] text-gray-400">{p.rangeLabel}</p>
            </div>
            <p
              className={`mt-1 text-2xl font-extrabold ${
                p.profit < 0 ? "text-red-600" : p.profit > 0 ? "text-green-600" : "text-gray-900"
              }`}
            >
              {signedTaka(p.profit)}
            </p>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">বিক্রি</dt>
                <dd className="font-semibold">৳ {formatTaka(p.revenue)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">কেনা দাম</dt>
                <dd className="font-semibold">৳ {formatTaka(p.cost)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">অর্ডার</dt>
                <dd className="font-semibold">{p.orders}</dd>
              </div>
            </dl>
            {p.uncostedOrders > 0 && (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700">
                {p.uncostedOrders}টি অর্ডারে খরচ সেট নেই (৳ {formatTaka(p.uncostedRevenue)}) — লাভে ধরা হয়নি
              </p>
            )}
          </div>
        ))}
      </div>

      {data.backfillableOrders > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:p-4">
          <p className="font-semibold">
            {data.backfillableOrders}টি ডেলিভারড অর্ডারে কেনা দাম সেট নেই — এগুলো সম্ভবত রেট সেট করার আগের অর্ডার।
          </p>
          <p className="mt-1">
            প্যাকেজের রেট <Link href="/admin/products" className="font-bold underline">Products</Link> পেজে সেট করে নিচের
            বাটনে চাপলে এই অর্ডারগুলোতে বর্তমান রেট বসে যাবে। যেসব অর্ডারে আগে থেকেই খরচ আছে সেগুলো বদলাবে না।
          </p>
          <form action={backfillOrderCostsAction} className="mt-2">
            <button className="w-full rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 sm:w-auto">
              পুরনো অর্ডারে বর্তমান রেট বসান
            </button>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <h2 className="mb-2 text-sm font-bold text-gray-700">গত ৭ দিনের দৈনিক লাভ</h2>
        <div className="divide-y divide-gray-100 text-xs">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-1.5 font-semibold text-gray-400">
            <span>দিন</span>
            <span className="text-right">অর্ডার</span>
            <span className="w-[4.5rem] text-right">বিক্রি</span>
            <span className="w-[4.5rem] text-right">লাভ</span>
          </div>
          {data.days.map((d) => (
            <div key={d.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-1.5">
              <span className="min-w-0 truncate font-semibold text-gray-700">
                {d.label}
                {d.uncostedOrders > 0 && (
                  <span className="ml-1 font-normal text-amber-600" title="খরচ সেট নেই এমন অর্ডার">
                    ({d.uncostedOrders} খরচ নেই)
                  </span>
                )}
              </span>
              <span className="text-right">{d.orders}</span>
              <span className="w-[4.5rem] text-right">৳ {formatTaka(d.revenue)}</span>
              <span
                className={`w-[4.5rem] text-right font-bold ${
                  d.profit < 0 ? "text-red-600" : d.profit > 0 ? "text-green-600" : "text-gray-500"
                }`}
              >
                {signedTaka(d.profit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-gray-700">UniPin স্টক ভ্যালু</h2>
            <p className="text-[11px] text-gray-500">Unused কোড × প্রতিটি কোডের কেনা দাম</p>
          </div>
          <p className="text-xl font-extrabold text-gray-900">৳ {formatTaka(data.stock.total)}</p>
        </div>
        {data.stock.uncostedCodes > 0 && (
          <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700">
            {data.stock.uncostedCodes}টি কোডের denom-এ কেনা দাম সেট নেই — মোট ভ্যালুতে ধরা হয়নি।
          </p>
        )}
        {data.stock.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            কোনো denom নেই।
          </p>
        ) : (
          <div className="space-y-2">
            {data.stock.rows.map((row) => (
              <div
                key={row.denom}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">Denom: {row.denom}</p>
                  <p className="text-[11px] text-gray-500">{row.unused} unused</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={setUnipinDenomCostAction} className="flex items-center gap-1">
                    <input type="hidden" name="denom" value={row.denom} />
                    <input
                      name="cost"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="প্রতি কোড ৳"
                      defaultValue={row.cost ?? ""}
                      aria-label={`Denom ${row.denom} এর কেনা দাম`}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button className="rounded-md border border-gray-300 px-2 py-1 text-xs font-bold hover:bg-gray-50">
                      Save
                    </button>
                  </form>
                  <span
                    className={`min-w-[4.5rem] text-right text-sm font-bold ${row.value === null ? "text-amber-600" : ""}`}
                  >
                    {row.value === null ? "রেট নেই" : `৳ ${formatTaka(row.value)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-500">
          এখানে সেট করা denom রেট দিয়ে সেইসব UniPin প্যাকেজের খরচও হিসাব হয় যেগুলোতে আলাদা কেনা দাম দেওয়া নেই।
        </p>
      </div>
    </div>
  );
}
