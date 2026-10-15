"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/data";
import { saveUploadedImage } from "@/lib/upload";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/actions/auth-actions";
import { getPaymentMethodConfig } from "@/lib/payment-methods";
import { describeEpsPayment, refreshEpsPayment, startEpsPayment, EpsStartError } from "@/lib/eps-payments";
import {
  clearEpsTokenCache,
  credentialsFrom,
  getEpsToken,
  getPaymentGatewaySetting,
  DEFAULT_EPS_API_BASE_URL,
} from "@/lib/eps-client";

export type EpsStartState = ActionState & { redirectUrl?: string };

// Mirrors depositSchema's bounds in lib/validation.ts.
const epsDepositSchema = z.object({
  amount: z.coerce.number().int().min(20, "সর্বনিম্ন ২০ টাকা জমা দিতে হবে").max(100000, "সর্বোচ্চ ১০০০০০ টাকা"),
});

export async function startEpsDepositAction(_prev: EpsStartState, formData: FormData): Promise<EpsStartState> {
  const session = await auth();
  if (!session?.user) return { error: "প্রথমে লগইন করুন।" };

  const [settings, methods] = await Promise.all([getSiteSettings(), getPaymentMethodConfig()]);
  if (!settings.depositEnabled) return { error: "ডিপোজিট আপাতত বন্ধ আছে।" };
  if (!methods.eps.enabled) return { error: "অটো পেমেন্ট এই মুহূর্তে চালু নেই।" };

  const parsed = epsDepositSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) return { fieldErrors: { amount: parsed.error.issues[0]?.message ?? "সঠিক অ্যামাউন্ট দিন" } };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, isBlocked: true, blockedUntil: true },
  });
  if (!user) return { error: "প্রথমে লগইন করুন।" };
  if (user.isBlocked && (!user.blockedUntil || user.blockedUntil > new Date())) {
    return { error: "আপনার একাউন্টটি ব্লক করা হয়েছে।" };
  }

  const ip = await getClientIp();
  if (!checkRateLimit(`eps-start:${user.id}`, 8, 10 * 60 * 1000)) {
    return { error: "অল্প সময়ে অনেকবার চেষ্টা করা হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।" };
  }

  try {
    const { redirectUrl } = await startEpsPayment({
      purpose: "DEPOSIT",
      amount: parsed.data.amount,
      userId: user.id,
      ip,
      customer: {
        name: user.name || "Customer",
        email: user.email,
        phone: user.phone || settings.whatsappNumber,
      },
      productName: `Wallet Add Money ৳${parsed.data.amount}`,
      productCategory: "Wallet",
    });
    return { success: true, redirectUrl };
  } catch (error) {
    if (error instanceof EpsStartError) return { error: error.message };
    throw error;
  }
}

export type EpsStatusView = {
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED";
  title: string;
  text: string;
  tone: "success" | "error" | "pending";
  orderSerial: number | null;
};

// The status page polls this. It is public (the customer may come back
// logged out), so it shows nothing beyond what the unguessable ref already
// implies, and it calls EPS at most once every few seconds per payment.
export async function checkEpsPaymentStatusAction(ref: string): Promise<EpsStatusView | null> {
  if (typeof ref !== "string" || !/^[a-f0-9]{32}$/.test(ref)) return null;

  const ip = await getClientIp();
  const payment = await prisma.epsPayment.findUnique({ where: { ref } });
  if (!payment) return null;

  const recentlyChecked = payment.lastCheckedAt && Date.now() - payment.lastCheckedAt.getTime() < 4000;
  let current = payment;
  if (payment.status !== "SUCCESS" && payment.status !== "EXPIRED" && !recentlyChecked && checkRateLimit(`eps-poll:${ip}`, 60, 60 * 1000)) {
    try {
      current = (await refreshEpsPayment(payment.id)).payment;
    } catch (error) {
      console.error("[eps] status poll failed:", error);
    }
  }

  const order = current.orderId
    ? await prisma.order.findUnique({ where: { id: current.orderId }, select: { orderSerial: true } })
    : null;
  return { status: current.status, ...describeEpsPayment(current), orderSerial: order?.orderSerial ?? null };
}

// ---------- Admin ----------

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized: admin access required");
  return session;
}

export async function adminRecheckEpsPaymentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("paymentId") || "");
  if (!id) return;
  try {
    await refreshEpsPayment(id);
  } catch (error) {
    console.error("[eps] admin recheck failed:", error);
  }
  revalidatePath("/admin/eps-payments");
}

const titleField = (fallback: string) =>
  z
    .string()
    .trim()
    .max(40, "সর্বোচ্চ ৪০ ক্যারেক্টার")
    .transform((v) => v || fallback);

const gatewaySchema = z.object({
  walletPayEnabled: z.boolean(),
  walletPayTitle: titleField("Wallet Pay"),
  manualPayEnabled: z.boolean(),
  manualPayTitle: titleField("Manual Pay"),
  epsEnabled: z.boolean(),
  epsTitle: titleField("Auto Pay"),
  epsSubtitle: z.string().trim().max(120, "সর্বোচ্চ ১২০ ক্যারেক্টার"),
  epsApiBaseUrl: z
    .string()
    .trim()
    .transform((v) => (v || DEFAULT_EPS_API_BASE_URL).replace(/\/+$/, ""))
    .pipe(z.string().regex(/^https:\/\/[^\s/]+(\/[^\s]*)?$/, "https:// দিয়ে শুরু হওয়া সঠিক URL দিন")),
  epsUserName: z.string().trim().max(200),
  epsMerchantId: z.string().trim().max(200),
  epsStoreId: z.string().trim().max(200),
  // Secrets: blank means "keep what is saved".
  epsPassword: z.string().max(500),
  epsHashKey: z.string().trim().max(1000),
});

export async function updatePaymentGatewaySettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = gatewaySchema.safeParse({
    walletPayEnabled: formData.get("walletPayEnabled") === "on",
    walletPayTitle: String(formData.get("walletPayTitle") ?? ""),
    manualPayEnabled: formData.get("manualPayEnabled") === "on",
    manualPayTitle: String(formData.get("manualPayTitle") ?? ""),
    epsEnabled: formData.get("epsEnabled") === "on",
    epsTitle: String(formData.get("epsTitle") ?? ""),
    epsSubtitle: String(formData.get("epsSubtitle") ?? ""),
    epsApiBaseUrl: String(formData.get("epsApiBaseUrl") ?? ""),
    epsUserName: String(formData.get("epsUserName") ?? ""),
    epsMerchantId: String(formData.get("epsMerchantId") ?? ""),
    epsStoreId: String(formData.get("epsStoreId") ?? ""),
    epsPassword: String(formData.get("epsPassword") ?? ""),
    epsHashKey: String(formData.get("epsHashKey") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const d = parsed.data;
  const current = await getPaymentGatewaySetting();

  // Kept at its original size (not icon-resized) — the logo strip is wide.
  let epsIcon = formData.get("epsIconRemove") === "on" ? null : current.epsIcon;
  const epsIconFile = formData.get("epsIconFile");
  if (epsIconFile instanceof File && epsIconFile.size > 0) {
    try {
      epsIcon = (await saveUploadedImage(epsIconFile, "eps-icon")) ?? epsIcon;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "আইকন আপলোড ব্যর্থ হয়েছে" };
    }
  }
  const next = {
    walletPayEnabled: d.walletPayEnabled,
    walletPayTitle: d.walletPayTitle,
    manualPayEnabled: d.manualPayEnabled,
    manualPayTitle: d.manualPayTitle,
    epsEnabled: d.epsEnabled,
    epsTitle: d.epsTitle,
    epsSubtitle: d.epsSubtitle || null,
    epsIcon,
    epsApiBaseUrl: d.epsApiBaseUrl,
    epsUserName: d.epsUserName || null,
    epsMerchantId: d.epsMerchantId || null,
    epsStoreId: d.epsStoreId || null,
    epsPassword: d.epsPassword ? d.epsPassword : current.epsPassword,
    epsHashKey: d.epsHashKey ? d.epsHashKey : current.epsHashKey,
  };

  if (!next.walletPayEnabled && !next.manualPayEnabled && !next.epsEnabled) {
    return { error: "অন্তত একটি পেমেন্ট মেথড চালু রাখতে হবে।" };
  }
  if (next.epsEnabled && !credentialsFrom({ ...current, ...next })) {
    return { error: "অটো পেমেন্ট চালু করতে EPS এর সবগুলো তথ্য (Username, Password, Hash Key, Merchant ID, Store ID) দিন।" };
  }

  const credentialsChanged =
    next.epsApiBaseUrl !== current.epsApiBaseUrl ||
    next.epsUserName !== current.epsUserName ||
    next.epsPassword !== current.epsPassword ||
    next.epsHashKey !== current.epsHashKey ||
    next.epsMerchantId !== current.epsMerchantId;

  await prisma.paymentGatewaySetting.update({ where: { id: 1 }, data: next });
  if (credentialsChanged) await clearEpsTokenCache();

  revalidatePath("/", "layout");
  revalidatePath("/admin/payment-settings");
  return { success: true };
}

export async function testEpsConnectionAction(_prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  const setting = await getPaymentGatewaySetting();
  const credentials = credentialsFrom(setting);
  if (!credentials) return { error: "আগে EPS এর সবগুলো তথ্য সেভ করুন।" };
  try {
    await getEpsToken(credentials, { force: true });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
