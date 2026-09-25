import { createGzip } from "zlib";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { prisma } from "@/lib/prisma";
import { streamSqlDump } from "@/lib/sql-dump";
import {
  createFolder,
  deleteFile,
  isFolderUsable,
  refreshAccessToken,
  resolveOAuthCredentials,
  uploadFile,
} from "@/lib/google-drive";

export const BACKUP_MIME = "application/gzip";
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000; // refresh a minute early rather than race the expiry
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export type BackupTrigger = "auto" | "manual" | "cron";

/** The singleton settings row, created on first read so the admin page never 404s. */
export async function getBackupSetting() {
  const existing = await prisma.backupSetting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  // upsert rather than create: the scheduler's first tick and the first page
  // load can land at the same moment on a fresh install.
  return prisma.backupSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

export function isDriveConnected(setting: { googleRefreshToken: string | null }) {
  return Boolean(setting.googleRefreshToken);
}

/** `topupshop-2026-09-25_18-00-00.sql.gz`, stamped in Dhaka time like the rest of the admin. */
function buildFileName(now: Date) {
  const shifted = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `_${pad(shifted.getUTCHours())}-${pad(shifted.getUTCMinutes())}-${pad(shifted.getUTCSeconds())}`;
  return `topupshop-${stamp}.sql.gz`;
}

/** Runs the dump through gzip, collecting only the compressed bytes. */
async function buildGzippedDump(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await pipeline(Readable.from(streamSqlDump()), createGzip({ level: 9 }), async (compressed) => {
    for await (const chunk of compressed) chunks.push(Buffer.from(chunk));
  });
  return Buffer.concat(chunks);
}

/**
 * A valid access token, refreshed and re-cached in the settings row when the
 * stored one has expired. Throws with a message meant for the admin UI.
 */
export async function getDriveAccessToken(setting: Awaited<ReturnType<typeof getBackupSetting>>) {
  if (!setting.googleRefreshToken) {
    throw new Error("Google Drive সংযুক্ত করা হয়নি — Connect Google Drive চাপুন।");
  }
  const credentials = resolveOAuthCredentials(setting);
  if (!credentials) {
    throw new Error("Google OAuth Client ID/Secret সেট করা হয়নি।");
  }

  if (
    setting.googleAccessToken &&
    setting.googleTokenExpiry &&
    setting.googleTokenExpiry.getTime() - TOKEN_EXPIRY_SKEW_MS > Date.now()
  ) {
    return setting.googleAccessToken;
  }

  const tokens = await refreshAccessToken({
    ...credentials,
    refreshToken: setting.googleRefreshToken,
  });
  await prisma.backupSetting.update({
    where: { id: 1 },
    data: {
      googleAccessToken: tokens.access_token,
      googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      // Google only re-issues a refresh token on re-consent; keep the old one otherwise.
      ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
    },
  });
  return tokens.access_token;
}

/**
 * The folder backups are uploaded into, created on first use. `drive.file`
 * can't list folders it didn't create, so a folder the admin deleted by hand
 * is simply replaced with a fresh one.
 */
async function ensureBackupFolder(
  accessToken: string,
  setting: Awaited<ReturnType<typeof getBackupSetting>>
) {
  if (setting.driveFolderId && (await isFolderUsable(accessToken, setting.driveFolderId))) {
    return setting.driveFolderId;
  }
  const folderId = await createFolder(accessToken, setting.driveFolderName || "TopupShop Backups");
  await prisma.backupSetting.update({ where: { id: 1 }, data: { driveFolderId: folderId } });
  return folderId;
}

/**
 * Deletes everything past the newest `keepCount` successful backups, from Drive
 * and from the log. Runs after every successful upload, so lowering keepCount
 * takes effect on the next run rather than needing a separate cleanup.
 */
async function pruneOldBackups(accessToken: string, keepCount: number) {
  const stale = await prisma.backupLog.findMany({
    where: { status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    skip: Math.max(1, keepCount),
    select: { id: true, driveFileId: true },
  });

  for (const backup of stale) {
    if (backup.driveFileId) {
      try {
        await deleteFile(accessToken, backup.driveFileId);
      } catch {
        // Leave the row alone so the next run retries the delete instead of
        // losing track of a file that's still sitting in Drive.
        continue;
      }
    }
    await prisma.backupLog.delete({ where: { id: backup.id } });
  }
}

// Dumping is heavy and Drive uploads are slow, so the scheduler, the cron
// endpoint and the "Backup now" button all share one in-process lock rather
// than stacking runs on top of each other.
let runInFlight: Promise<BackupResult> | null = null;

export type BackupResult = {
  ok: boolean;
  fileName?: string;
  sizeBytes?: number;
  error?: string;
  skipped?: boolean;
};

async function performBackup(trigger: BackupTrigger): Promise<BackupResult> {
  const startedAt = Date.now();
  const setting = await getBackupSetting();
  const fileName = buildFileName(new Date());

  await prisma.backupSetting.update({ where: { id: 1 }, data: { lastRunAt: new Date() } });

  try {
    const accessToken = await getDriveAccessToken(setting);
    const folderId = await ensureBackupFolder(accessToken, setting);
    const archive = await buildGzippedDump();
    const uploaded = await uploadFile({
      accessToken,
      folderId,
      name: fileName,
      mimeType: BACKUP_MIME,
      body: archive,
    });

    await prisma.backupLog.create({
      data: {
        fileName,
        driveFileId: uploaded.id,
        sizeBytes: archive.byteLength,
        status: "SUCCESS",
        trigger,
        durationMs: Date.now() - startedAt,
      },
    });
    await prisma.backupSetting.update({
      where: { id: 1 },
      data: { lastSuccessAt: new Date(), lastError: null },
    });

    await pruneOldBackups(accessToken, setting.keepCount);

    return { ok: true, fileName, sizeBytes: archive.byteLength };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backup error";
    await prisma.backupLog.create({
      data: {
        fileName,
        status: "FAILED",
        trigger,
        durationMs: Date.now() - startedAt,
        error: message.slice(0, 2000),
      },
    });
    await prisma.backupSetting.update({
      where: { id: 1 },
      data: { lastError: message.slice(0, 2000) },
    });
    return { ok: false, error: message };
  }
}

/** Never throws — the outcome is always reported through the returned result. */
export async function runBackup(trigger: BackupTrigger): Promise<BackupResult> {
  if (runInFlight) {
    return { ok: false, skipped: true, error: "একটি ব্যাকআপ এখনো চলছে।" };
  }
  runInFlight = performBackup(trigger).finally(() => {
    runInFlight = null;
  });
  return runInFlight;
}

export function isBackupRunning() {
  return runInFlight !== null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
