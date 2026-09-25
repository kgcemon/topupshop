import { prisma } from "@/lib/prisma";
import { formatBytes, getBackupSetting, isDriveConnected } from "@/lib/backup";
import { getDriveRedirectUri, getRequestOrigin } from "@/lib/backup-redirect";
import { resolveOAuthCredentials } from "@/lib/google-drive";
import { formatDhakaDateTime } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { BackupSettingsForm } from "@/components/backup-settings-form";
import { BackupRunButton } from "@/components/backup-run-button";
import {
  deleteBackupAction,
  disconnectDriveAction,
  regenerateCronSecretAction,
} from "@/lib/actions/backup-actions";

// The settings row is created on first load and the access token is refreshed
// in place, so this page can never be served from a cache.
export const dynamic = "force-dynamic";

function formatWhen(date: Date | null) {
  return date ? formatDhakaDateTime(date) : "—";
}

export default async function AdminBackupsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const [setting, logs] = await Promise.all([
    getBackupSetting(),
    prisma.backupLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const driveConnected = isDriveConnected(setting);
  const redirectUri = await getDriveRedirectUri();
  const origin = await getRequestOrigin();
  const hasOAuthClient = Boolean(resolveOAuthCredentials(setting));
  const cronUrl = setting.cronSecret ? `${origin}/api/backup/run?secret=${setting.cronSecret}` : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h1 className="mb-1 text-lg font-bold">Backups</h1>
        <p className="text-sm text-gray-500">
          পুরো ডাটাবেসের SQL ডাম্প (gzip করা <code className="font-mono">.sql.gz</code>) নির্দিষ্ট সময়
          পরপর আপনার Google Drive-এ জমা হবে। সবচেয়ে নতুন কয়েকটি রাখা হয়, বাকিগুলো Drive থেকে
          স্বয়ংক্রিয়ভাবে মুছে যায়।
        </p>

        {connected && (
          <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Google Drive সফলভাবে সংযুক্ত হয়েছে।
          </p>
        )}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">Google Drive সংযোগ</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              driveConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {driveConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        {driveConnected && (
          <p className="mb-3 text-sm">
            অ্যাকাউন্ট: <span className="font-semibold">{setting.googleEmail ?? "—"}</span>
            {setting.driveFolderId && (
              <>
                {" · "}
                <a
                  className="font-semibold text-primary-600 underline"
                  href={`https://drive.google.com/drive/folders/${setting.driveFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ব্যাকআপ ফোল্ডার খুলুন
                </a>
              </>
            )}
          </p>
        )}

        <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p className="mb-2 font-bold text-gray-700">প্রথমবার সেটআপ:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Google Cloud Console → APIs &amp; Services → <b>Google Drive API</b> চালু করুন, তারপর
              Credentials থেকে একটি <b>OAuth client ID (Web application)</b> তৈরি করুন।
            </li>
            <li>
              সেই ক্লায়েন্টের <b>Authorized redirect URI</b>-তে হুবহু এই ঠিকানাটি যোগ করুন:
              <span className="mt-1 flex items-center gap-2">
                <code className="break-all rounded bg-white px-2 py-1 font-mono">{redirectUri}</code>
                <CopyButton value={redirectUri} label="" />
              </span>
            </li>
            <li>নিচের ফর্মে Client ID ও Secret বসিয়ে সেভ করুন, তারপর Connect চাপুন।</li>
            <li>
              OAuth consent screen-এর <b>Publishing status</b> অবশ্যই <b>In production</b> করে দিন।
              Testing অবস্থায় Google প্রতি ৭ দিনে টোকেন বাতিল করে দেয়, ফলে ব্যাকআপ হঠাৎ বন্ধ হয়ে যাবে।
              (এখানে শুধু <code className="font-mono">drive.file</code> স্কোপ চাওয়া হয় — এটি sensitive
              নয়, তাই Google-এর আলাদা ভেরিফিকেশন লাগে না, আর এই অ্যাপ Drive-এর অন্য কোনো ফাইল দেখতেও
              পারে না।)
            </li>
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasOAuthClient ? (
            <a
              href="/api/admin/backup/google/start"
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-bold text-white hover:bg-primary-600"
            >
              {driveConnected ? "আবার Connect করুন" : "Connect Google Drive"}
            </a>
          ) : (
            <span className="text-sm text-gray-500">Connect করার আগে Client ID ও Secret সেভ করুন।</span>
          )}
          {driveConnected && (
            <form action={disconnectDriveAction}>
              <button className="rounded-md border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
                Disconnect
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-base font-bold">ব্যাকআপ সেটিংস</h2>
        <BackupSettingsForm
          defaultValues={{
            enabled: setting.enabled,
            intervalMinutes: setting.intervalMinutes,
            keepCount: setting.keepCount,
            driveFolderName: setting.driveFolderName,
            googleClientId: setting.googleClientId,
            hasClientSecret: Boolean(setting.googleClientSecret),
          }}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="mb-3 text-base font-bold">ম্যানুয়াল ব্যাকআপ</h2>
        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            <span className="text-gray-500">শেষ চেষ্টা:</span> {formatWhen(setting.lastRunAt)}
          </p>
          <p>
            <span className="text-gray-500">শেষ সফল ব্যাকআপ:</span> {formatWhen(setting.lastSuccessAt)}
          </p>
          <p>
            <span className="text-gray-500">রাখা হচ্ছে:</span> সর্বশেষ {setting.keepCount}টি
          </p>
        </div>
        {setting.lastError && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            শেষ ত্রুটি: {setting.lastError}
          </p>
        )}
        <BackupRunButton disabled={!driveConnected} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="mb-2 text-base font-bold">এক্সটার্নাল ক্রন (ঐচ্ছিক)</h2>
        <p className="mb-3 text-xs text-gray-500">
          সার্ভার একাধিক ইনস্ট্যান্সে চললে বা আইডল হয়ে ঘুমিয়ে গেলে ভেতরের টাইমার মিস হতে পারে।
          সেক্ষেত্রে cPanel বা cron-job.org দিয়ে প্রতি ঘণ্টায় এই URL-টি কল করুন।
        </p>
        {cronUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs">{cronUrl}</code>
            <CopyButton value={cronUrl} label="" />
          </div>
        ) : (
          <p className="text-sm text-gray-500">এখনো কোনো সিক্রেট তৈরি হয়নি।</p>
        )}
        <form action={regenerateCronSecretAction} className="mt-3">
          <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-bold hover:bg-gray-50">
            {cronUrl ? "নতুন সিক্রেট তৈরি করুন" : "সিক্রেট তৈরি করুন"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-base font-bold">ব্যাকআপ হিস্ট্রি</h2>
        {logs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
            এখনো কোনো ব্যাকআপ নেওয়া হয়নি।
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-bold">{log.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {formatDhakaDateTime(log.createdAt)}
                    {log.sizeBytes != null && ` · ${formatBytes(log.sizeBytes)}`}
                    {log.durationMs != null && ` · ${(log.durationMs / 1000).toFixed(1)}s`}
                    {` · ${log.trigger}`}
                  </p>
                  {log.error && <p className="mt-1 text-xs text-red-600">{log.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      log.status === "SUCCESS" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {log.status}
                  </span>
                  {log.driveFileId && (
                    <a
                      href={`https://drive.google.com/file/d/${log.driveFileId}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs font-bold hover:bg-gray-50"
                    >
                      Drive-এ দেখুন
                    </a>
                  )}
                  <form action={deleteBackupAction}>
                    <input type="hidden" name="id" value={log.id} />
                    <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50">
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
  );
}
