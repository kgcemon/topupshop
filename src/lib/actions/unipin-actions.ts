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

// Genuine UniPin vouchers always start with one of these two prefixes —
// anything else pasted into the box (stray text, a different vendor's
// codes, a copy-paste mistake) is silently ignored rather than stored, so
// the pool never fills up with junk that would later fail redemption.
const VALID_CODE_PREFIXES = ["UPBD", "BDMB"];

// Cap on how many skipped/ignored codes get echoed back in the redirect URL
// — beyond this the admin still gets the total counts, just not every code.
const MAX_LISTED_CODES = 25;

export async function addUnipinCodesAction(formData: FormData) {
  await requireAdmin();
  const denom = String(formData.get("denom") || "").trim();
  const rawCodes = codesFromTextarea(formData.get("codes"));
  if (!denom || rawCodes.length === 0) {
    redirect("/admin/unipin");
  }

  const validCodes: string[] = [];
  const invalidCodes: string[] = [];
  for (const code of rawCodes) {
    if (VALID_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
      validCodes.push(code);
    } else {
      invalidCodes.push(code);
    }
  }

  // skipDuplicates would tell us only a count, not which codes were skipped
  // — checking first lets the result banner name the actual duplicate codes.
  const existing = validCodes.length
    ? await prisma.unipinCode.findMany({ where: { code: { in: validCodes } }, select: { code: true } })
    : [];
  const existingSet = new Set(existing.map((row) => row.code));
  const duplicateCodes = validCodes.filter((code) => existingSet.has(code));
  const toInsert = validCodes.filter((code) => !existingSet.has(code));

  if (toInsert.length > 0) {
    // `code` is @unique in the schema, so a code can never exist twice (and
    // therefore never be claimed/redeemed for two orders) no matter how it
    // got in — skipDuplicates is just a race-safety net here, since the
    // duplicate check above already excluded everything that existed at
    // read time; it stops a genuinely simultaneous submission of the same
    // new code from throwing instead of just leaving one row in place.
    await prisma.unipinCode.createMany({
      data: toInsert.map((code) => ({ denom, code })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/unipin");
  const params = new URLSearchParams({
    added: String(toInsert.length),
    skipped: String(duplicateCodes.length),
    invalid: String(invalidCodes.length),
  });
  if (duplicateCodes.length > 0) params.set("dupCodes", duplicateCodes.slice(0, MAX_LISTED_CODES).join(","));
  if (invalidCodes.length > 0) params.set("invalidCodes", invalidCodes.slice(0, MAX_LISTED_CODES).join(","));
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
