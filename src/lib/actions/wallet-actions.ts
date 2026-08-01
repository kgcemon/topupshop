"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { depositSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function depositAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "প্রথমে লগইন করুন।" };
  }

  const parsed = depositSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method"),
    transactionId: formData.get("transactionId"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const { amount, method, transactionId } = parsed.data;

  await prisma.walletTransaction.create({
    data: {
      userId: session.user.id,
      type: "DEPOSIT",
      method,
      amount,
      transactionId,
      status: "PENDING",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
  return { success: true };
}
