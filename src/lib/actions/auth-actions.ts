"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { generateReferralCode } from "@/lib/utils";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isIpBlocked, applyAbuseBlock, detectMaliciousInput } from "@/lib/security";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  values?: {
    name?: string;
    phone?: string;
    email?: string;
    referralCode?: string;
  };
};

export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ip = await getClientIp();
  if (await isIpBlocked(ip)) {
    return { error: "সন্দেহজনক কার্যকলাপের কারণে আপনার আইপি সাময়িকভাবে ব্লক করা হয়েছে। ২৪ ঘণ্টা পর আবার চেষ্টা করুন।" };
  }
  if (!checkRateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return { error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" };
  }

  const values = {
    name: (formData.get("name") as string) || "",
    phone: (formData.get("phone") as string) || "",
    email: (formData.get("email") as string) || "",
    referralCode: (formData.get("referralCode") as string) || "",
  };

  if (detectMaliciousInput(values.name, values.phone, values.referralCode)) {
    await applyAbuseBlock({ userId: null, ip, reason: "রেজিস্ট্রেশন ফর্মে সন্দেহজনক ইনপুট সনাক্ত হয়েছে" });
    return { error: "সন্দেহজনক ইনপুট সনাক্ত হয়েছে। নিরাপত্তার কারণে আপনার আইপি ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
  }

  const parsed = registerSchema.safeParse({
    ...values,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors, values };
  }

  const { name, phone, email, password, referralCode } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "এই ইমেইল দিয়ে ইতিমধ্যে একাউন্ট আছে" }, values };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const referrer = referralCode
    ? await prisma.user.findUnique({ where: { referralCode } })
    : null;

  const signupSource = (await cookies()).get("signup_source")?.value || "Direct";

  await prisma.user.create({
    data: {
      name,
      phone,
      email,
      password: hashedPassword,
      referralCode: generateReferralCode(),
      referredById: referrer?.id ?? null,
      signupSource,
    },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "একাউন্ট তৈরি হয়েছে, তবে অটো লগইন ব্যর্থ হয়েছে। ম্যানুয়ালি লগইন করুন।" };
    }
    throw error;
  }

  return { success: true };
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ip = await getClientIp();
  if (await isIpBlocked(ip)) {
    return { error: "সন্দেহজনক কার্যকলাপের কারণে আপনার আইপি সাময়িকভাবে ব্লক করা হয়েছে। ২৪ ঘণ্টা পর আবার চেষ্টা করুন।" };
  }
  if (!checkRateLimit(`login:${ip}`, 8, 5 * 60 * 1000)) {
    return { error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" };
  }

  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = (formData.get("callbackUrl") as string) || "/dashboard";

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "AccessDenied") {
        return { error: "আপনার একাউন্টটি সাময়িক বা স্থায়ীভাবে ব্লক করা হয়েছে। সহায়তার জন্য যোগাযোগ করুন।" };
      }
      return { error: "ইমেইল অথবা পাসওয়ার্ড সঠিক নয়" };
    }
    throw error;
  }

  return { success: true };
}
