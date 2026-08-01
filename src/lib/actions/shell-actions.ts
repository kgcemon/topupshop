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

export async function createShellAccountAction(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const server = String(formData.get("server") || "").trim();
  if (!label || !accountId || !password) return;

  await prisma.garenaShellAccount.create({
    data: {
      label,
      accountId,
      password,
      code: code || null,
      server: server || null,
    },
  });

  revalidatePath("/admin/shell");
}

export async function deleteShellAccountAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.garenaShellAccount.delete({ where: { id } });
  revalidatePath("/admin/shell");
}
