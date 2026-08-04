"use server";

import { randomBytes } from "crypto";
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

const SMS_SENDER_METHODS = ["BKASH", "NAGAD", "ROCKET"] as const;

function parseSmsSenderForm(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const methodRaw = String(formData.get("method") || "BKASH");
  const method = SMS_SENDER_METHODS.includes(methodRaw as (typeof SMS_SENDER_METHODS)[number])
    ? (methodRaw as (typeof SMS_SENDER_METHODS)[number])
    : "BKASH";
  return { name, method };
}

export async function createSmsSenderAction(formData: FormData) {
  await requireAdmin();
  const { name, method } = parseSmsSenderForm(formData);
  if (!name) return;

  await prisma.smsSender.create({ data: { name, method } });
  revalidatePath("/admin/sms-settings");
}

export async function updateSmsSenderAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const { name, method } = parseSmsSenderForm(formData);
  if (!name) return;

  await prisma.smsSender.update({ where: { id }, data: { name, method } });
  revalidatePath("/admin/sms-settings");
}

export async function toggleSmsSenderActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(id)) return;

  await prisma.smsSender.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/admin/sms-settings");
}

export async function deleteSmsSenderAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  await prisma.smsSender.delete({ where: { id } });
  revalidatePath("/admin/sms-settings");
}

// Generates/rotates the shared secret the mobile SMS-forwarder app must pass
// as ?secret= to /api/payment-sms (see that route for why this is required).
// Rotating it immediately invalidates the old URL, so the admin must update
// the forwarder app's configured webhook URL afterwards.
export async function regeneratePaymentSmsSecretAction() {
  await requireAdmin();
  const paymentSmsSecret = randomBytes(24).toString("hex");

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: { id: 1, paymentSmsSecret },
    update: { paymentSmsSecret },
  });
  revalidatePath("/admin/sms-settings");
}

// Toggles balance-chain verification on/off and/or (re)sets the per-method
// starting checkpoint. Clearing a checkpoint field (blank input) resets it to
// null so the next SMS for that method bootstraps a fresh baseline instead of
// comparing against a stale one.
export async function updateBalanceVerifySettingsAction(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("enabled") === "true";

  function parseCheckpoint(name: string) {
    const raw = String(formData.get(name) ?? "").trim();
    if (raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      paymentSmsBalanceVerifyEnabled: enabled,
      bkashBalanceCheckpoint: parseCheckpoint("bkashBalanceCheckpoint"),
      nagadBalanceCheckpoint: parseCheckpoint("nagadBalanceCheckpoint"),
      rocketBalanceCheckpoint: parseCheckpoint("rocketBalanceCheckpoint"),
    },
    update: {
      paymentSmsBalanceVerifyEnabled: enabled,
      bkashBalanceCheckpoint: parseCheckpoint("bkashBalanceCheckpoint"),
      nagadBalanceCheckpoint: parseCheckpoint("nagadBalanceCheckpoint"),
      rocketBalanceCheckpoint: parseCheckpoint("rocketBalanceCheckpoint"),
    },
  });
  revalidatePath("/admin/sms-settings");
}
