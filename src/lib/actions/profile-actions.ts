"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validation";
import { saveUploadedAvatar } from "@/lib/upload";
import { checkRateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/actions/auth-actions";

const NAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ProfileActionState = ActionState & {
  imageUrl?: string;
};

export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "প্রথমে লগইন করুন।" };
  }

  const userId = session.user.id;

  if (!checkRateLimit(`profile-update:${userId}`, 10, 10 * 60 * 1000)) {
    return { error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" };
  }

  const values = {
    name: (formData.get("name") as string) || "",
    phone: (formData.get("phone") as string) || "",
  };

  const parsed = profileUpdateSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, values };
  }

  const { name, phone } = parsed.data;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true, nameChangedAt: true },
  });
  if (!currentUser) {
    return { error: "ইউজার পাওয়া যায়নি।" };
  }

  const isNameChanging = name !== (currentUser.name ?? "");
  if (isNameChanging && currentUser.nameChangedAt) {
    const nextAllowedAt = new Date(currentUser.nameChangedAt.getTime() + NAME_CHANGE_COOLDOWN_MS);
    if (nextAllowedAt > new Date()) {
      const nextAllowedLabel = nextAllowedAt.toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return {
        fieldErrors: { name: `মাসে একবারই নাম পরিবর্তন করা যায়। পরবর্তী পরিবর্তন করতে পারবেন ${nextAllowedLabel} থেকে।` },
        values,
      };
    }
  }

  let imageUrl: string | undefined;
  const avatarFile = formData.get("avatarFile");
  if (avatarFile instanceof File && avatarFile.size > 0) {
    try {
      const savedPath = await saveUploadedAvatar(avatarFile, `avatar-${userId}`);
      if (savedPath) imageUrl = savedPath;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ছবি আপলোড ব্যর্থ হয়েছে।", values };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      phone,
      ...(imageUrl ? { image: imageUrl } : {}),
      ...(isNameChanging ? { nameChangedAt: new Date() } : {}),
    },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/", "layout");

  return { success: true, values, imageUrl };
}
