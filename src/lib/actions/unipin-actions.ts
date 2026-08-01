"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

function codesFromTextarea(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      String(value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

export async function addUnipinCodesAction(formData: FormData) {
  await requireAdmin();
  const denom = String(formData.get("denom") || "").trim();
  const codes = codesFromTextarea(formData.get("codes"));
  if (!denom || codes.length === 0) {
    redirect("/admin/unipin");
  }

  const result = await prisma.unipinCode.createMany({
    data: codes.map((code) => ({ denom, code })),
    skipDuplicates: true,
  });

  revalidatePath("/admin/unipin");
  const params = new URLSearchParams({
    added: String(result.count),
    skipped: String(codes.length - result.count),
  });
  redirect(`/admin/unipin?${params.toString()}#denom-${encodeURIComponent(denom)}`);
}

export async function deleteUnipinCodeAction(formData: FormData) {
  await requireAdmin();
  const codeId = String(formData.get("codeId") || "");
  if (!codeId) return;

  // Only an unused code can be deleted — a used one is tied to a delivered order.
  await prisma.unipinCode.deleteMany({ where: { id: codeId, status: "UNUSED" } });

  revalidatePath("/admin/unipin");
}
