"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

// Must list every ApiSettingType the form offers: anything missing here is
// silently coerced to OTHER on save, which then matches no provider lookup.
const API_SETTING_TYPES = ["UNIPIN", "SHELL", "FFLIKES", "GARENA_SHELL", "OTHER"] as const;

function parseApiSettingForm(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const typeRaw = String(formData.get("type") || "OTHER");
  const type = API_SETTING_TYPES.includes(typeRaw as (typeof API_SETTING_TYPES)[number])
    ? (typeRaw as (typeof API_SETTING_TYPES)[number])
    : "OTHER";
  const apiKey = String(formData.get("apiKey") || "").trim();
  const apiSecret = String(formData.get("apiSecret") || "").trim();
  const endpoint = String(formData.get("endpoint") || "").trim();
  const code = String(formData.get("code") || "").trim();
  return { name, type, apiKey, apiSecret, endpoint, code };
}

export async function createApiSettingAction(formData: FormData) {
  await requireAdmin();
  const { name, type, apiKey, apiSecret, endpoint, code } = parseApiSettingForm(formData);
  if (!name) return;

  await prisma.apiSetting.create({
    data: {
      name,
      type,
      apiKey: apiKey || null,
      apiSecret: apiSecret || null,
      endpoint: endpoint || null,
      code: code || null,
    },
  });

  revalidatePath("/admin/api-settings");
}

export async function updateApiSettingAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const { name, type, apiKey, apiSecret, endpoint, code } = parseApiSettingForm(formData);
  if (!name) return;

  await prisma.apiSetting.update({
    where: { id },
    data: {
      name,
      type,
      apiKey: apiKey || null,
      apiSecret: apiSecret || null,
      endpoint: endpoint || null,
      code: code || null,
    },
  });

  revalidatePath("/admin/api-settings");
}

export async function toggleApiSettingActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(id)) return;

  await prisma.apiSetting.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/admin/api-settings");
}

export async function deleteApiSettingAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  await prisma.apiSetting.delete({ where: { id } });
  revalidatePath("/admin/api-settings");
}
