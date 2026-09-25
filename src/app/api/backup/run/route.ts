import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getBackupSetting, runBackup } from "@/lib/backup";

// External cron entry point, for hosts where the in-process scheduler isn't
// enough (multiple instances, or a process that sleeps when idle). Guarded by
// the shared secret from /admin/backups, exactly like /api/payment-sms:
//
//   curl -fsS "https://example.com/api/backup/run?secret=..."
//
// The interval check still applies, so calling it more often than
// BackupSetting.intervalMinutes is harmless — pass ?force=1 to override.
async function handle(request: NextRequest) {
  const setting = await getBackupSetting();
  const providedSecret = request.nextUrl.searchParams.get("secret") ?? "";
  if (!setting.cronSecret || providedSecret !== setting.cronSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  if (!setting.enabled) {
    return NextResponse.json({ ok: false, message: "Backups are disabled" }, { status: 409 });
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && setting.lastRunAt) {
    const dueAt = setting.lastRunAt.getTime() + Math.max(5, setting.intervalMinutes) * 60 * 1000;
    if (Date.now() < dueAt) {
      return NextResponse.json({ ok: true, skipped: true, message: "Not due yet", dueAt: new Date(dueAt) });
    }
  }

  const result = await runBackup("cron");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
