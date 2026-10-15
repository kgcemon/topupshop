"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDenomCostMap, getEffectiveCost } from "@/lib/profit";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

// Buy price of one UniPin voucher of `denom`. Blank removes the rate.
export async function setUnipinDenomCostAction(formData: FormData) {
  await requireAdmin();
  const denom = String(formData.get("denom") || "").trim();
  const costRaw = String(formData.get("cost") || "").trim();
  if (!denom) return;

  if (costRaw === "") {
    await prisma.unipinDenomCost.deleteMany({ where: { denom } });
  } else {
    const cost = Number(costRaw);
    if (!Number.isFinite(cost) || cost < 0) return;
    const rounded = Math.round(cost * 100) / 100;
    await prisma.unipinDenomCost.upsert({
      where: { denom },
      create: { denom, cost: rounded },
      update: { cost: rounded },
    });
  }

  revalidatePath("/admin/profit");
}

// Delivered orders created before their package had a rate keep a null cost.
// This fills those in from today's rates — it never touches an order that
// already has a cost, so past profit stays as it was recorded.
export async function backfillOrderCostsAction() {
  await requireAdmin();

  const [uncosted, denomCosts] = await Promise.all([
    prisma.order.groupBy({
      by: ["rechargeOptionId"],
      where: { status: "DELIVERED", costAmount: null },
    }),
    getDenomCostMap(),
  ]);
  if (uncosted.length === 0) return;

  const options = await prisma.rechargeOption.findMany({
    where: { id: { in: uncosted.map((row) => row.rechargeOptionId) } },
    select: { id: true, costPrice: true, deliveryMethod: true, denom: true },
  });

  for (const option of options) {
    const cost = getEffectiveCost(option, denomCosts);
    if (cost === null) continue;
    await prisma.order.updateMany({
      where: { rechargeOptionId: option.id, status: "DELIVERED", costAmount: null },
      data: { costAmount: cost },
    });
  }

  revalidatePath("/admin/profit");
}
