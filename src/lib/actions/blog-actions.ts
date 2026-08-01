"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blogCommentSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { createNotification } from "@/lib/notifications";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { applyAbuseBlock, detectMaliciousInput } from "@/lib/security";

export type CommentActionState = ActionState & { commentId?: string };

export async function incrementBlogPostViewAction(postId: number) {
  try {
    await prisma.blogPost.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });
  } catch {
    // Best-effort — e.g. the post could have been deleted mid-request.
  }
}

export async function toggleBlogLikeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const postId = Number(formData.get("postId"));
  const slug = String(formData.get("slug") || "");

  const existing = await prisma.blogLike.findUnique({
    where: { postId_userId: { postId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.blogLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.blogLike.create({ data: { postId, userId: session.user.id } });
  }

  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/blog");
  revalidatePath("/");
}

export async function createBlogCommentAction(
  _prevState: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "কমেন্ট করতে হলে প্রথমে লগইন করুন।" };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isBlocked: true, blockedUntil: true },
  });
  const isCurrentlyBlocked =
    dbUser?.isBlocked && (!dbUser.blockedUntil || dbUser.blockedUntil > new Date());
  if (isCurrentlyBlocked) {
    return { error: "আপনার একাউন্টটি ব্লক করা হয়েছে, তাই মন্তব্য করা যাচ্ছে না।" };
  }

  if (!checkRateLimit(`comment:${session.user.id}`, 5, 60 * 1000)) {
    await applyAbuseBlock({
      userId: session.user.id,
      ip: await getClientIp(),
      reason: "অল্প সময়ে অনেক মন্তব্য (স্প্যাম) সনাক্ত হয়েছে",
    });
    return { error: "আপনি অনেক দ্রুত অনেকগুলো মন্তব্য করছেন। নিরাপত্তার কারণে ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
  }

  const parsed = blogCommentSchema.safeParse({
    postId: formData.get("postId"),
    content: formData.get("content"),
    parentId: formData.get("parentId") || "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  if (detectMaliciousInput(parsed.data.content)) {
    await applyAbuseBlock({
      userId: session.user.id,
      ip: await getClientIp(),
      reason: "মন্তব্যে সন্দেহজনক ইনপুট (স্ক্রিপ্ট/ইনজেকশন) সনাক্ত হয়েছে",
    });
    return { error: "সন্দেহজনক ইনপুট সনাক্ত হয়েছে। নিরাপত্তার কারণে আপনাকে ২৪ ঘণ্টার জন্য ব্লক করা হয়েছে।" };
  }

  const post = await prisma.blogPost.findUnique({ where: { id: parsed.data.postId } });
  if (!post) return { error: "পোস্ট খুঁজে পাওয়া যায়নি।" };

  const parentId = parsed.data.parentId || null;
  const parent = parentId ? await prisma.blogComment.findUnique({ where: { id: parentId } }) : null;

  const comment = await prisma.blogComment.create({
    data: {
      postId: parsed.data.postId,
      userId: session.user.id,
      content: parsed.data.content,
      parentId,
    },
  });

  if (parent) {
    const actorName = session.user.name || session.user.email || "একজন ইউজার";
    await createNotification(prisma, {
      userId: parent.userId,
      actorId: session.user.id,
      type: "COMMENT_REPLY",
      message: `${actorName} আপনার মন্তব্যে রিপ্লাই দিয়েছে`,
      link: `/blog/${post.slug}`,
    });
  }

  revalidatePath(`/blog/${post.slug}`);
  return { success: true, commentId: comment.id };
}

export async function toggleBlogCommentLikeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const commentId = String(formData.get("commentId"));
  const slug = String(formData.get("slug") || "");

  const existing = await prisma.blogCommentLike.findUnique({
    where: { commentId_userId: { commentId, userId: session.user.id } },
  });

  if (existing) {
    await prisma.blogCommentLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.blogCommentLike.create({ data: { commentId, userId: session.user.id } });

    const likedComment = await prisma.blogComment.findUnique({ where: { id: commentId } });
    if (likedComment) {
      const actorName = session.user.name || session.user.email || "একজন ইউজার";
      await createNotification(prisma, {
        userId: likedComment.userId,
        actorId: session.user.id,
        type: "COMMENT_LIKE",
        message: `${actorName} আপনার মন্তব্যে লাইক দিয়েছে`,
        link: slug ? `/blog/${slug}` : null,
      });
    }
  }

  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function deleteBlogCommentAction(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }

  const commentId = String(formData.get("commentId"));
  const slug = String(formData.get("slug") || "");

  await prisma.blogComment.delete({ where: { id: commentId } });

  if (slug) revalidatePath(`/blog/${slug}`);
}
