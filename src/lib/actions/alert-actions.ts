"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkUnipinLowStock, getAlertSetting, sendAdminAlert } from "@/lib/alerts";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

export async function saveLowStockSettingsAction(formData: FormData) {
  await requireAdmin();
  const lowStockEnabled = formData.get("enabled") === "true";
  const threshold = Math.floor(Number(formData.get("threshold")));
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100000) return;

  await getAlertSetting();
  await prisma.alertSetting.update({
    where: { id: 1 },
    data: { lowStockEnabled, lowStockThreshold: threshold },
  });
  // A new threshold changes which denoms count as low — start fresh.
  await prisma.unipinStockAlert.deleteMany({});
  revalidatePath("/admin/alerts");
}

// Blank token/secret fields keep the stored value, so the admin can save the
// form without re-pasting secrets. A Verify Token is generated on first save.
export async function saveMessengerSettingsAction(formData: FormData) {
  await requireAdmin();
  const pageToken = String(formData.get("pageToken") || "").trim();
  const appSecret = String(formData.get("appSecret") || "").trim();

  const setting = await getAlertSetting();
  await prisma.alertSetting.update({
    where: { id: 1 },
    data: {
      ...(pageToken ? { messengerPageToken: pageToken } : {}),
      ...(appSecret ? { messengerAppSecret: appSecret } : {}),
      ...(setting.messengerVerifyToken ? {} : { messengerVerifyToken: randomBytes(16).toString("hex") }),
    },
  });
  revalidatePath("/admin/alerts");
}

export async function generateMessengerConnectCodeAction() {
  await requireAdmin();
  await getAlertSetting();
  const code = `TS-${randomBytes(3).toString("hex").toUpperCase()}`;
  await prisma.alertSetting.update({ where: { id: 1 }, data: { messengerConnectCode: code } });
  revalidatePath("/admin/alerts");
}

export async function disconnectMessengerAction() {
  await requireAdmin();
  await getAlertSetting();
  await prisma.alertSetting.update({
    where: { id: 1 },
    data: {
      messengerRecipientId: null,
      messengerConnectedAt: null,
      messengerLastInboundAt: null,
      messengerConnectCode: null,
    },
  });
  revalidatePath("/admin/alerts");
}

export async function sendTestAlertAction() {
  await requireAdmin();
  const result = await sendAdminAlert("🔔 টেস্ট অ্যালার্ট — Messenger অ্যালার্ট ঠিকমতো কাজ করছে।");
  revalidatePath("/admin/alerts");
  redirect(`/admin/alerts?test=${result.ok ? "ok" : "fail"}`);
}

export async function checkLowStockNowAction() {
  await requireAdmin();
  const result = await checkUnipinLowStock();
  revalidatePath("/admin/alerts");
  redirect(`/admin/alerts?checked=${result.newlyLow.length}&sent=${result.sent ? 1 : 0}`);
}
