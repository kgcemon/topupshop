import { getBackupSetting, runBackup } from "@/lib/backup";

// How often the timer wakes up to ask "is a backup due yet?". Deliberately much
// shorter than the interval itself: a restart resets the timer, so checking
// against the stored lastRunAt every few minutes keeps an hourly schedule
// roughly hourly even on a server that gets redeployed often.
const TICK_MS = 5 * 60 * 1000;

const globalForScheduler = globalThis as unknown as { backupSchedulerTimer?: NodeJS.Timeout };

async function tick() {
  try {
    const setting = await getBackupSetting();
    if (!setting.enabled || !setting.googleRefreshToken) return;

    const intervalMs = Math.max(5, setting.intervalMinutes) * 60 * 1000;
    const dueAt = setting.lastRunAt ? setting.lastRunAt.getTime() + intervalMs : 0;
    if (Date.now() < dueAt) return;

    const result = await runBackup("auto");
    if (!result.ok && !result.skipped) {
      console.error("[backup] scheduled run failed:", result.error);
    }
  } catch (error) {
    // The timer has to survive every failure — a crashed tick would silently
    // end all future backups until the next deploy.
    console.error("[backup] scheduler tick failed:", error);
  }
}

/**
 * Starts the in-process hourly scheduler. Safe to call more than once (dev
 * hot-reload re-runs instrumentation); the timer is kept on globalThis.
 *
 * This covers the common single-server deployment. On a platform that runs
 * several instances — or that sleeps the process when idle — point an external
 * cron at /api/backup/run?secret=... instead, and leave this running too: the
 * lastRunAt check means whichever fires first simply satisfies the interval.
 */
export function startBackupScheduler() {
  if (globalForScheduler.backupSchedulerTimer) return;

  const timer = setInterval(tick, TICK_MS);
  // Don't hold the process open on shutdown just for the timer.
  timer.unref?.();
  globalForScheduler.backupSchedulerTimer = timer;

  // Catch up right after boot in case the server was down when a run was due.
  void tick();
}
