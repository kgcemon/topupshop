"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settlePendingWithPaymentSms } from "@/lib/payment-sms-settle";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

export async function togglePaymentSmsStatusAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "UNUSED");
  if (!Number.isFinite(id)) return;

  await prisma.paymentSms.update({
    where: { id },
    data: { status: status === "USED" ? "UNUSED" : "USED" },
  });
  revalidatePath("/admin/store-sms");
}

// Re-enables (or manually disables) a PaymentSms row for auto-matching —
// primarily used to clear the `isActive: false` flag set when balance-chain
// verification flags an SMS as suspicious, once an admin has reviewed it.
export async function togglePaymentSmsActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(id)) return;

  await prisma.paymentSms.update({
    where: { id },
    data: { isActive: !isActive },
  });

  // Clearing a flagged SMS is the point at which it becomes eligible for
  // auto-matching, so run the same late-settlement pass the ingest route does
  // — otherwise an admin who unblocks an SMS still has to approve the order
  // it pays for by hand.
  if (!isActive) {
    const settled = await settlePendingWithPaymentSms(id);
    if (settled.settled === "order") {
      revalidatePath("/admin/orders");
      revalidatePath("/dashboard/orders");
    } else if (settled.settled === "wallet") {
      revalidatePath("/admin/wallet-requests");
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/deposit");
    }
  }

  revalidatePath("/admin/store-sms");
}

export async function deletePaymentSmsAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  await prisma.paymentSms.delete({ where: { id } });
  revalidatePath("/admin/store-sms");
}
