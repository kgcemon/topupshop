export async function register() {
  // The Edge runtime has no timers that outlive a request (and no DB access
  // through the MariaDB driver adapter), so the scheduler is Node-only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` also boots a server instance to render pages; nothing should
  // be backed up from there.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startBackupScheduler } = await import("@/lib/backup-scheduler");
  startBackupScheduler();
}
