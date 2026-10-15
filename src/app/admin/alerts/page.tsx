import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAlertSetting, getUnipinStockLevels } from "@/lib/alerts";
import { formatDhakaDateTime } from "@/lib/utils";
import { SecretField } from "@/components/secret-field";
import { CopyButton } from "@/components/copy-button";
import {
  saveLowStockSettingsAction,
  saveMessengerSettingsAction,
  generateMessengerConnectCodeAction,
  disconnectMessengerAction,
  sendTestAlertAction,
  checkLowStockNowAction,
} from "@/lib/actions/alert-actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const dateOpts = { dateStyle: "medium", timeStyle: "short" } as const;

export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; checked?: string; sent?: string }>;
}) {
  const { test, checked, sent } = await searchParams;
  const [setting, levels, alerted] = await Promise.all([
    getAlertSetting(),
    getUnipinStockLevels(),
    prisma.unipinStockAlert.findMany(),
  ]);

  const callbackUrl = `${SITE_URL}/api/messenger/webhook`;
  const connected = Boolean(setting.messengerRecipientId);
  const hasToken = Boolean(setting.messengerPageToken);
  const low = levels.filter((l) => l.unused < setting.lowStockThreshold);
  const alertedSet = new Set(alerted.map((a) => a.denom));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Alerts</h1>

      {test && (
        <p
          className={`rounded-md border px-3 py-2 text-xs font-semibold break-words ${
            test === "ok" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {test === "ok"
            ? "টেস্ট মেসেজ পাঠানো হয়েছে — আপনার Messenger চেক করুন।"
            : `টেস্ট মেসেজ যায়নি: ${setting.messengerLastError ?? "অজানা সমস্যা"}`}
        </p>
      )}
      {checked !== undefined && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
          {Number(checked) === 0
            ? "নতুন করে কম স্টকের কোনো denom পাওয়া যায়নি (আগে অ্যালার্ট দেওয়া denom আবার পাঠানো হয় না)।"
            : `${checked}টি denom-এ স্টক কম — ${sent === "1" ? "Messenger-এ অ্যালার্ট পাঠানো হয়েছে।" : "কিন্তু অ্যালার্ট পাঠানো যায়নি, নিচে সমস্যা দেখুন।"}`}
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <h2 className="mb-1 text-sm font-bold text-gray-700">UniPin লো স্টক অ্যালার্ট</h2>
        <p className="mb-3 text-xs text-gray-500">
          কোনো denom-এর unused কোড নির্দিষ্ট সংখ্যার নিচে নামলে Messenger-এ মেসেজ যাবে। প্রতিটি denom-এর জন্য একবারই
          যাবে — কোড যোগ করে স্টক আবার বাড়লে অ্যালার্ট আবার চালু হবে।
        </p>
        <form action={saveLowStockSettingsAction} className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="enabled"
              value="true"
              defaultChecked={setting.lowStockEnabled}
              className="h-4 w-4"
            />
            অ্যালার্ট চালু
          </label>
          <div>
            <label className="mb-1 block text-xs font-semibold">এর নিচে নামলে জানাবে</label>
            <input
              name="threshold"
              type="number"
              min={1}
              required
              defaultValue={setting.lowStockThreshold}
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button className="w-full rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 sm:w-auto">
            Save
          </button>
        </form>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-500">
              এখন কম স্টক ({setting.lowStockThreshold}টির নিচে): {low.length}টি denom
            </p>
            <form action={checkLowStockNowAction}>
              <button
                disabled={!setting.lowStockEnabled}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-bold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                এখনই চেক করুন
              </button>
            </form>
          </div>
          {low.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 py-4 text-center text-xs text-gray-400">
              সব denom-এ পর্যাপ্ত স্টক আছে।
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {low.map((l) => (
                <Link
                  key={l.denom}
                  href={`/admin/unipin#denom-${encodeURIComponent(l.denom)}`}
                  className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                >
                  {l.denom}: {l.unused}
                  {alertedSet.has(l.denom) ? " ✓" : ""}
                </Link>
              ))}
            </div>
          )}
          {low.length > 0 && <p className="mt-1.5 text-[11px] text-gray-400">✓ = অ্যালার্ট পাঠানো হয়েছে</p>}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-700">Facebook Messenger সংযোগ</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {connected ? "সংযুক্ত" : "সংযুক্ত নয়"}
          </span>
        </div>

        <details className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-gray-700" open={!connected}>
          <summary className="cursor-pointer font-bold text-blue-800">কীভাবে সংযোগ করবেন (ধাপে ধাপে)</summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>আপনার দোকানের একটি Facebook Page লাগবে, যার admin আপনি।</li>
            <li>
              <span className="font-semibold">developers.facebook.com</span> → My Apps → Create App। Use case-এ
              Messenger (&quot;Engage with customers on Messenger&quot;) বেছে নিন।
            </li>
            <li>
              App-এর Messenger → API Settings-এ আপনার Page যোগ করে <span className="font-semibold">Generate token</span>{" "}
              চাপুন। সেই Page Access Token নিচের ঘরে বসান। App Settings → Basic থেকে{" "}
              <span className="font-semibold">App Secret</span> কপি করে বসান, তারপর Save করুন।
            </li>
            <li>
              একই পেজের <span className="font-semibold">Configure webhooks</span>-এ নিচের Callback URL আর Verify Token
              বসিয়ে &quot;Verify and save&quot; চাপুন। তারপর Page-এর webhook subscription-এ{" "}
              <span className="font-semibold">messages</span> চালু করুন।
            </li>
            <li>
              নিচে &quot;Connect কোড তৈরি করুন&quot; চাপুন, আর আপনার নিজের Messenger থেকে Page-এ কোডটি মেসেজ করুন। সংযুক্ত
              হলে Page থেকে ✅ রিপ্লাই আসবে।
            </li>
            <li>&quot;টেস্ট মেসেজ পাঠান&quot; দিয়ে যাচাই করুন।</li>
          </ol>
          <p className="mt-2 text-[11px] text-gray-500">
            App Live করা বা App Review লাগবে না — আপনি app-এর admin, তাই Development mode-এ থেকেও মেসেজ পাবেন। Facebook-এর
            নিয়মে Page শেষবার আপনার মেসেজ পাওয়ার ২৪ ঘণ্টা পর মেসেজ পাঠানো সীমিত হতে পারে; সেজন্য মাঝে মাঝে Page-এ যেকোনো
            একটা মেসেজ পাঠিয়ে রাখলে অ্যালার্ট নিশ্চিতভাবে আসবে।
          </p>
        </details>

        <div className="mb-4 space-y-2 text-xs">
          <div>
            <p className="mb-1 font-semibold text-gray-600">Callback URL</p>
            <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono">{callbackUrl}</span>
              <CopyButton value={callbackUrl} label="" />
            </div>
          </div>
          <div>
            <p className="mb-1 font-semibold text-gray-600">Verify Token</p>
            <div className="rounded-md bg-gray-50 px-2 py-1.5">
              <SecretField value={setting.messengerVerifyToken} placeholder="প্রথমবার Save করলে তৈরি হবে" />
            </div>
          </div>
        </div>

        <form action={saveMessengerSettingsAction} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Page Access Token</label>
            <input
              name="pageToken"
              type="password"
              autoComplete="off"
              placeholder={hasToken ? "সেভ করা আছে — বদলাতে চাইলে নতুনটা দিন" : "EAAG..."}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">App Secret</label>
            <input
              name="appSecret"
              type="password"
              autoComplete="off"
              placeholder={setting.messengerAppSecret ? "সেভ করা আছে — বদলাতে চাইলে নতুনটা দিন" : "App Settings → Basic"}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button className="w-full rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600 sm:w-auto">
            Save
          </button>
        </form>

        <div className="mt-4 border-t border-gray-100 pt-4">
          {connected ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-600">
                সংযুক্ত হয়েছে:{" "}
                {setting.messengerConnectedAt ? formatDhakaDateTime(setting.messengerConnectedAt, dateOpts) : "—"}
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={sendTestAlertAction}>
                  <button className="rounded-md bg-secondary-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                    টেস্ট মেসেজ পাঠান
                  </button>
                </form>
                <form action={disconnectMessengerAction}>
                  <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                    Disconnect
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {setting.messengerConnectCode ? (
                <div className="rounded-md border border-primary-100 bg-primary-50 p-3">
                  <p className="text-xs text-gray-600">আপনার Messenger থেকে Page-এ এই কোডটি পাঠান:</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-lg font-extrabold tracking-wider">
                      {setting.messengerConnectCode}
                    </span>
                    <CopyButton value={setting.messengerConnectCode} label="" />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">পাঠানোর পর এই পেজ রিফ্রেশ করুন।</p>
                </div>
              ) : null}
              <form action={generateMessengerConnectCodeAction}>
                <button
                  disabled={!hasToken}
                  className="rounded-md bg-secondary-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {setting.messengerConnectCode ? "নতুন কোড তৈরি করুন" : "Connect কোড তৈরি করুন"}
                </button>
              </form>
              {!hasToken && <p className="text-[11px] text-gray-400">আগে Page Access Token সেভ করুন।</p>}
            </div>
          )}

          <div className="mt-3 space-y-1 text-[11px] text-gray-500">
            {setting.messengerLastSentAt && (
              <p>শেষ অ্যালার্ট পাঠানো: {formatDhakaDateTime(setting.messengerLastSentAt, dateOpts)}</p>
            )}
            {setting.messengerLastError && (
              <p className="font-semibold break-words text-red-600">শেষ সমস্যা: {setting.messengerLastError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
