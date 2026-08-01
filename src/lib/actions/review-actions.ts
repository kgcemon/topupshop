"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewFormSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { applyAbuseBlock, detectMaliciousInput } from "@/lib/security";

export async function submitReviewAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "রিভিউ দিতে হলে প্রথমে লগইন করুন।" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isBlocked: true, blockedUntil: true },
  });
  const isCurrentlyBlocked =
    dbUser?.isBlocked && (!dbUser.blockedUntil || dbUser.blockedUntil > new Date());
  if (isCurrentlyBlocked) {
    return { error: "আপনার একাউন্টটি ব্লক করা হয়েছে, তাই রিভিউ দেওয়া যাচ্ছে না।" };
  }

  if (!checkRateLimit(`review:${session.user.id}`, 5, 60 * 1000)) {
    await applyAbuseBlock({
      userId: session.user.id,
      ip: await getClientIp(),
      reason: "অল্প সময়ে অনেকবার রিভিউ সাবমিট (স্প্যাম) সনাক্ত হয়েছে",
    });
    return { error: "আপনি অনেক দ্রুত অনেকবার চেষ্টা করছেন। নিরাপত্তার কারণে ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
  }

  const parsed = reviewFormSchema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  if (detectMaliciousInput(parsed.data.comment)) {
    await applyAbuseBlock({
      userId: session.user.id,
      ip: await getClientIp(),
      reason: "রিভিউতে সন্দেহজনক ইনপুট (স্ক্রিপ্ট/ইনজেকশন) সনাক্ত হয়েছে",
    });
    return { error: "সন্দেহজনক ইনপুট সনাক্ত হয়েছে। নিরাপত্তার কারণে আপনাকে ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true },
  });
  if (!product) {
    return { error: "প্রোডাক্ট খুঁজে পাওয়া যায়নি।" };
  }

  // Re-submitting always resets isApproved to false — an edited review needs
  // fresh moderation rather than silently keeping its old approved status.
  await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId: session.user.id } },
    create: {
      productId: product.id,
      userId: session.user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      isApproved: false,
    },
    update: {
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      isApproved: false,
    },
  });

  revalidatePath(`/topup/${product.id}/${product.slug}`);
  revalidatePath("/admin/reviews");
  return { success: true };
}
