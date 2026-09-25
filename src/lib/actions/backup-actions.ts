"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBackupSetting, getDriveAccessToken, runBackup } from "@/lib/backup";
import { deleteFile } from "@/lib/google-drive";
import type { ActionState } from "@/lib/actions/auth-actions";

const BACKUP_PATH = "/admin/backups";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export async function saveBackupSettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  await getBackupSetting(); // makes sure row 1 exists before the update below

  const clientId = String(formData.get("googleClientId") || "").trim();
  const clientSecret = String(formData.get("googleClientSecret") || "").trim();
  const folderName = String(formData.get("driveFolderName") || "").trim() || "TopupShop Backups";

  await prisma.backupSetting.update({
    where: { id: 1 },
    data: {
      enabled: formData.get("enabled") === "on",
      // Below 5 minutes the scheduler's own tick would become the bottleneck,
      // and a week is a sane upper bound for "hourly-ish".
      intervalMinutes: parsePositiveInt(formData.get("intervalMinutes"), 60, 5, 10080),
      keepCount: parsePositiveInt(formData.get("keepCount"), 5, 1, 50),
      driveFolderName: folderName,
      googleClientId: clientId || null,
      // Blank means "leave the stored secret alone" — the form never renders it back.
      ...(clientSecret ? { googleClientSecret: clientSecret } : {}),
    },
  });

  revalidatePath(BACKUP_PATH);
  return { success: true };
}

export async function runBackupNowAction(
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const result = await runBackup("manual");
  revalidatePath(BACKUP_PATH);
  if (!result.ok) return { error: result.error ?? "ব্যাকআপ ব্যর্থ হয়েছে।" };
  return { success: true };
}

export async function disconnectDriveAction() {
  await requireAdmin();
  await getBackupSetting();
  // Backups can't run without a token, so turn the schedule off at the same
  // time rather than letting it fail every hour.
  await prisma.backupSetting.update({
    where: { id: 1 },
    data: {
      enabled: false,
      googleRefreshToken: null,
      googleAccessToken: null,
      googleTokenExpiry: null,
      googleEmail: null,
      driveFolderId: null,
      oauthState: null,
      lastError: null,
    },
  });
  revalidatePath(BACKUP_PATH);
}

export async function regenerateCronSecretAction() {
  await requireAdmin();
  await getBackupSetting();
  await prisma.backupSetting.update({
    where: { id: 1 },
    data: { cronSecret: randomBytes(24).toString("hex") },
  });
  revalidatePath(BACKUP_PATH);
}

export async function deleteBackupAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const backup = await prisma.backupLog.findUnique({ where: { id } });
  if (!backup) return;

  if (backup.driveFileId) {
    const setting = await getBackupSetting();
    try {
      await deleteFile(await getDriveAccessToken(setting), backup.driveFileId);
    } catch {
      // Keep the row: dropping it would leave an orphaned file in Drive that
      // retention can no longer find.
      return;
    }
  }

  await prisma.backupLog.delete({ where: { id } });
  revalidatePath(BACKUP_PATH);
}
