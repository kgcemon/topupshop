"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  blogPostFormSchema,
  productFormSchema,
  siteSettingsSchema,
  sectionFormSchema,
  broadcastNotificationSchema,
} from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { saveUploadedImage, saveUploadedIcon } from "@/lib/upload";
import { grantFirstOrderReferralBonus } from "@/lib/referral";
import { createNotification } from "@/lib/notifications";
import { formatOrderNumber } from "@/lib/utils";
import { processOrderFulfillment } from "@/lib/order-fulfillment";
import { submitToIndexNow } from "@/lib/indexnow";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

export async function updateOrderStatusAction(formData: FormData) {
  const session = await requireAdmin();

  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as
    | "APPROVED"
    | "RUNNING"
    | "REJECTED"
    | "DELIVERED"
    | "CANCELLED";
  const adminNote = String(formData.get("adminNote") || "");
  const redirectStatus = String(formData.get("redirectStatus") || "ALL");
  const redirectQuery = String(formData.get("redirectQuery") || "");

  // Small, fast transaction: just atomically claim the status transition.
  // Kept separate from Unipin fulfillment below because that involves a live
  // network call — never hold a DB transaction (and its locks) open across one.
  const { order, enteringApproved, enteringDelivered, enteringCancelledOrRejected, noteChanged } =
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { rechargeOption: true },
      });

      // Also re-attempts when re-submitting APPROVED on an order already stuck there
      // (e.g. after restocking a denom that was short) — anything short of RUNNING/
      // DELIVERED means codes haven't been successfully claimed yet. Actual claiming
      // is idempotent regardless (see fulfillUnipinOrder), so this is just when to try.
      const enteringApproved =
        status === "APPROVED" && current.status !== "RUNNING" && current.status !== "DELIVERED";
      const enteringDelivered = status === "DELIVERED" && current.status !== "DELIVERED";
      const noteChanged =
        adminNote.trim().length > 0 && adminNote.trim() !== (current.adminNote ?? "").trim();
      const enteringCancelledOrRejected =
        (status === "REJECTED" || status === "CANCELLED") &&
        current.status !== "REJECTED" &&
        current.status !== "CANCELLED";

      // Atomically claim the transition: only succeeds if the order's status is still
      // what we just read. Under InnoDB, this UPDATE re-checks the WHERE clause against
      // the latest committed row after acquiring the lock, so two concurrent reviews of
      // the same order serialize here and the loser gets count === 0 — preventing the
      // side effects below from ever running twice.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: current.status },
        data: {
          status,
          adminNote: adminNote || null,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new Error("অর্ডারের স্ট্যাটাস অন্য কোথাও পরিবর্তিত হয়েছে, পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      }

      return { order: current, enteringApproved, enteringDelivered, enteringCancelledOrRejected, noteChanged };
    });

  // On approval, dispatch to whichever delivery method this option uses
  // (UniPin claims/buys codes, Shell calls its own API, Manual is a no-op),
  // then either promote the order to RUNNING or alert admins — see
  // processOrderFulfillment. Runs outside any DB transaction since it may
  // call out to a live API. Idempotent — a second call for the same order
  // (e.g. a retried approval) is always a safe no-op once fulfillment
  // already succeeded once.
  if (enteringApproved) {
    await processOrderFulfillment(order.id, order.rechargeOption.deliveryMethod, {
      orderSerial: order.orderSerial,
      actorId: session.user.id,
    });
  }

  await prisma.$transaction(async (tx) => {
    // Release any Unipin codes already claimed for this order back to stock —
    // covers rejecting/cancelling an order that had reached RUNNING. Clearing
    // redeemedAt too is essential: a recycled code with a stale redeemedAt
    // would silently skip the redeem API call on whichever future order
    // claims it next (see unipin-queue.ts), never actually delivering it.
    if (enteringCancelledOrRejected) {
      await tx.unipinCode.updateMany({
        where: { usedForOrderId: order.id },
        data: { status: "UNUSED", usedAt: null, usedForOrderId: null, redeemedAt: null },
      });

      // Reset the fulfillment job too, so a future re-approval (an admin can
      // always flip a rejected/cancelled order back to APPROVED) starts a
      // fresh claim instead of being skipped as already COMPLETED/FAILED.
      await tx.fulfillmentJob.deleteMany({ where: { orderId: order.id } });
    }

    // Restore the reserved stock unit for a rejected/cancelled order
    // (stock is reserved at order placement time, regardless of payment method).
    if (enteringCancelledOrRejected) {
      await tx.rechargeOption.updateMany({
        where: { id: order.rechargeOptionId, stock: { not: null } },
        data: { stock: { increment: 1 } },
      });
    }

    // Refund the wallet if a wallet-paid order is being rejected/cancelled
    // and it wasn't already in a refunded state. Guest orders (userId null)
    // can never be WALLET-paid, so this never applies to them.
    const isRefundableRejection =
      order.paymentMethod === "WALLET" && enteringCancelledOrRejected;

    if (order.userId && isRefundableRejection) {
      await tx.user.update({
        where: { id: order.userId },
        data: { walletBalance: { increment: order.amount } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          type: "REFUND",
          method: "WALLET",
          amount: order.amount,
          status: "APPROVED",
          note: `Refund for cancelled/rejected order ${formatOrderNumber(order.orderSerial)}`,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
    }

    // Referral bonuses and in-app notifications only apply to orders placed by
    // a registered user — guest orders have no account to credit or notify.
    if (order.userId) {
      if (enteringDelivered) {
        await grantFirstOrderReferralBonus(tx, {
          buyerId: order.userId,
          orderId: order.id,
          orderSerial: order.orderSerial,
          orderAmount: order.amount,
          reviewedById: session.user.id,
        });

        await createNotification(tx, {
          userId: order.userId,
          type: "ORDER_COMPLETED",
          message: `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} সফলভাবে ডেলিভার হয়েছে!`,
          link: "/dashboard/orders",
        });
      }

      if (noteChanged) {
        await createNotification(tx, {
          userId: order.userId,
          actorId: session.user.id,
          type: "ORDER_NOTE",
          message: `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} এ একটি নোট যোগ হয়েছে: "${adminNote.trim()}"`,
          link: "/dashboard/orders",
        });
      }
    }
  });

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  const params = new URLSearchParams({ status: redirectStatus });
  if (redirectQuery) params.set("q", redirectQuery);
  redirect(`/admin/orders?${params.toString()}`);
}

export async function updateWalletTransactionAction(formData: FormData) {
  const session = await requireAdmin();

  const txId = String(formData.get("transactionId"));
  const status = String(formData.get("status")) as "APPROVED" | "REJECTED";

  await prisma.$transaction(async (tx) => {
    // Atomically claim the review: only succeeds while the request is still PENDING,
    // so two concurrent approve clicks can't both pass and double-credit the wallet.
    const claimed = await tx.walletTransaction.updateMany({
      where: { id: txId, status: "PENDING" },
      data: {
        status,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new Error("এই রিকোয়েস্টটি ইতিমধ্যে রিভিউ করা হয়েছে।");
    }

    const walletTx = await tx.walletTransaction.findUniqueOrThrow({ where: { id: txId } });
    if (status === "APPROVED" && walletTx.type === "DEPOSIT") {
      await tx.user.update({
        where: { id: walletTx.userId },
        data: { walletBalance: { increment: walletTx.amount } },
      });
    }
  });

  revalidatePath("/admin/wallet-requests");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/deposit");
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(productId)) return;

  const product = await prisma.product.update({
    where: { id: productId },
    data: { isActive: !isActive },
  });

  revalidatePath("/admin/products");
  revalidatePath("/");

  // Product just went live — worth an immediate ping rather than waiting
  // for the next scheduled sitemap crawl.
  if (!isActive) {
    await submitToIndexNow(`/topup/${product.id}/${product.slug}`);
  }
}

export async function toggleProductStockAction(formData: FormData) {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  const stockOut = formData.get("stockOut") === "true";
  if (!Number.isFinite(productId)) return;

  await prisma.product.update({
    where: { id: productId },
    data: { stockOut: !stockOut },
  });

  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function deleteRechargeOptionAction(formData: FormData) {
  await requireAdmin();
  const optionId = Number(formData.get("optionId"));
  const productId = formData.get("productId");
  if (!Number.isFinite(optionId)) return;

  await prisma.rechargeOption.delete({ where: { id: optionId } });

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/");
}

const DELIVERY_METHODS = ["UNIPIN", "SHELL", "MANUAL"] as const;

function parseDeliveryMethod(formData: FormData): (typeof DELIVERY_METHODS)[number] {
  const raw = String(formData.get("deliveryMethod") || "MANUAL");
  return DELIVERY_METHODS.includes(raw as (typeof DELIVERY_METHODS)[number])
    ? (raw as (typeof DELIVERY_METHODS)[number])
    : "MANUAL";
}

export async function addRechargeOptionAction(formData: FormData) {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  const label = String(formData.get("label") || "").trim();
  const price = Number(formData.get("price"));
  const stockRaw = String(formData.get("stock") || "").trim();
  const stock = stockRaw === "" ? null : Number(stockRaw);
  const denom = String(formData.get("denom") || "").trim();
  const deliveryMethod = parseDeliveryMethod(formData);

  if (!label || !Number.isFinite(price)) return;
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) return;

  const last = await prisma.rechargeOption.findFirst({
    where: { productId },
    orderBy: { sortOrder: "desc" },
  });

  await prisma.rechargeOption.create({
    data: {
      productId,
      label,
      price,
      stock,
      denom: denom || null,
      deliveryMethod,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/");
}

export async function updateRechargeOptionDenomAction(formData: FormData) {
  await requireAdmin();
  const optionId = Number(formData.get("optionId"));
  const productId = formData.get("productId");
  const denom = String(formData.get("denom") || "").trim();
  if (!Number.isFinite(optionId)) return;

  await prisma.rechargeOption.update({
    where: { id: optionId },
    data: { denom: denom || null },
  });

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/admin/unipin");
}

export async function updateRechargeOptionDeliveryMethodAction(formData: FormData) {
  await requireAdmin();
  const optionId = Number(formData.get("optionId"));
  const productId = formData.get("productId");
  if (!Number.isFinite(optionId)) return;
  const deliveryMethod = parseDeliveryMethod(formData);

  await prisma.rechargeOption.update({
    where: { id: optionId },
    data: { deliveryMethod },
  });

  revalidatePath(`/admin/products/${productId}/edit`);
}

export async function updateRechargeOptionStockAction(formData: FormData) {
  await requireAdmin();
  const optionId = Number(formData.get("optionId"));
  const productId = formData.get("productId");
  const stockRaw = String(formData.get("stock") || "").trim();
  const stock = stockRaw === "" ? null : Number(stockRaw);

  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) return;

  await prisma.rechargeOption.update({
    where: { id: optionId },
    data: { stock },
  });

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/");
}

async function resolveProductImage(formData: FormData): Promise<string | { error: string }> {
  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploaded = await saveUploadedImage(imageFile, "product");
      if (uploaded) return uploaded;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ইমেজ আপলোড ব্যর্থ হয়েছে" };
    }
  }
  return String(formData.get("image") || "");
}

function parseProductForm(formData: FormData, resolvedImage: string) {
  return productFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    image: resolvedImage,
    sectionId: formData.get("sectionId"),
    type: formData.get("type"),
    externalUrl: formData.get("externalUrl") || "",
    category: formData.get("category"),
    description: formData.get("description") || "",
    isActive: formData.get("isActive") === "on",
    stockOut: formData.get("stockOut") === "on",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

function rulesFromTextarea(value: FormDataEntryValue | null) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function createProductAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const resolvedImage = await resolveProductImage(formData);
  if (typeof resolvedImage === "object") {
    return { fieldErrors: { image: resolvedImage.error } };
  }
  const parsed = parseProductForm(formData, resolvedImage);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const existing = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { fieldErrors: { slug: "এই slug ইতিমধ্যে ব্যবহৃত হয়েছে" } };
  }

  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      externalUrl: parsed.data.externalUrl || null,
      description: parsed.data.description || null,
      rules: rulesFromTextarea(formData.get("rules")),
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/");
  if (product.isActive) {
    await submitToIndexNow(`/topup/${product.id}/${product.slug}`);
  }
  redirect(`/admin/products/${product.id}/edit`);
}

export async function updateProductAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  if (!Number.isFinite(productId)) {
    return { error: "Invalid product." };
  }
  const resolvedImage = await resolveProductImage(formData);
  if (typeof resolvedImage === "object") {
    return { fieldErrors: { image: resolvedImage.error } };
  }
  const parsed = parseProductForm(formData, resolvedImage);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  const existing = await prisma.product.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: productId } },
  });
  if (existing) {
    return { fieldErrors: { slug: "এই slug ইতিমধ্যে ব্যবহৃত হয়েছে" } };
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...parsed.data,
      externalUrl: parsed.data.externalUrl || null,
      description: parsed.data.description || null,
      rules: rulesFromTextarea(formData.get("rules")),
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/");
  if (product.isActive) {
    await submitToIndexNow(`/topup/${product.id}/${product.slug}`);
  }
  return { success: true };
}

function parseSectionForm(formData: FormData) {
  return sectionFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createSectionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseSectionForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await prisma.section.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { fieldErrors: { slug: "এই slug ইতিমধ্যে ব্যবহৃত হয়েছে" } };
  }

  await prisma.section.create({ data: parsed.data });

  revalidatePath("/admin/sections");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/");
  return { success: true };
}

export async function updateSectionAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    return { error: "Invalid section." };
  }

  const parsed = parseSectionForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await prisma.section.findFirst({ where: { slug: parsed.data.slug, NOT: { id } } });
  if (existing) {
    return { fieldErrors: { slug: "এই slug ইতিমধ্যে ব্যবহৃত হয়েছে" } };
  }

  await prisma.section.update({ where: { id }, data: parsed.data });

  revalidatePath("/admin/sections");
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { success: true };
}

export async function deleteSectionAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  // A section with products can't be deleted (the FK would reject it anyway,
  // and deleting products' section out from under them would break the site).
  const productCount = await prisma.product.count({ where: { sectionId: id } });
  if (productCount > 0) return;

  await prisma.section.delete({ where: { id } });

  revalidatePath("/admin/sections");
  revalidatePath("/");
}

export async function toggleSectionActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(id)) return;

  await prisma.section.update({ where: { id }, data: { isActive: !isActive } });

  revalidatePath("/admin/sections");
  revalidatePath("/");
}

async function resolveBlogCoverImage(formData: FormData): Promise<string | { error: string }> {
  const imageFile = formData.get("coverImageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      const uploaded = await saveUploadedImage(imageFile, "blog");
      if (uploaded) return uploaded;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "কভার ইমেজ আপলোড ব্যর্থ হয়েছে" };
    }
  }
  return String(formData.get("coverImage") || "");
}

function parseBlogPostForm(formData: FormData) {
  return blogPostFormSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt") || "",
    content: formData.get("content"),
    metaTitle: formData.get("metaTitle") || "",
    metaDescription: formData.get("metaDescription") || "",
    metaKeywords: formData.get("metaKeywords") || "",
    isPublished: formData.get("isPublished") === "on",
  });
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createBlogPostAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const resolvedCover = await resolveBlogCoverImage(formData);
  if (typeof resolvedCover === "object") {
    return { fieldErrors: { coverImage: resolvedCover.error } };
  }
  const parsed = parseBlogPostForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await prisma.blogPost.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return { fieldErrors: { slug: "এই slug ইতিমধ্যে ব্যবহৃত হয়েছে" } };
  }

  const post = await prisma.blogPost.create({
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      content: parsed.data.content,
      coverImage: resolvedCover || null,
      metaTitle: parsed.data.metaTitle || null,
      metaDescription: parsed.data.metaDescription || null,
      metaKeywords: parsed.data.metaKeywords || null,
      isPublished: parsed.data.isPublished,
    },
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (post.isPublished) {
    await submitToIndexNow([`/blog/${post.slug}`, "/blog"]);
  }
  redirect(`/admin/blog/${post.id}/edit`);
}

export async function updateBlogPostAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const postId = Number(formData.get("postId"));
  const resolvedCover = await resolveBlogCoverImage(formData);
  if (typeof resolvedCover === "object") {
    return { fieldErrors: { coverImage: resolvedCover.error } };
  }
  const parsed = parseBlogPostForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await prisma.blogPost.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: postId } },
  });
  if (existing) {
    return { fieldErrors: { slug: "এই slug ইতিমধ্যে ব্যবহৃত হয়েছে" } };
  }

  const previous = await prisma.blogPost.findUniqueOrThrow({ where: { id: postId } });

  const post = await prisma.blogPost.update({
    where: { id: postId },
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      excerpt: parsed.data.excerpt || null,
      content: parsed.data.content,
      coverImage: resolvedCover || null,
      metaTitle: parsed.data.metaTitle || null,
      metaDescription: parsed.data.metaDescription || null,
      metaKeywords: parsed.data.metaKeywords || null,
      isPublished: parsed.data.isPublished,
    },
  });

  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${postId}/edit`);
  revalidatePath("/blog");
  revalidatePath(`/blog/${previous.slug}`);
  if (previous.slug !== parsed.data.slug) revalidatePath(`/blog/${parsed.data.slug}`);
  if (post.isPublished) {
    await submitToIndexNow([`/blog/${post.slug}`, "/blog"]);
  }
  return { success: true };
}

export async function toggleBlogPostPublishedAction(formData: FormData) {
  await requireAdmin();
  const postId = Number(formData.get("postId"));
  const isPublished = formData.get("isPublished") === "true";
  if (!Number.isFinite(postId)) return;
  const post = await prisma.blogPost.update({ where: { id: postId }, data: { isPublished: !isPublished } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  if (!isPublished) {
    await submitToIndexNow([`/blog/${post.slug}`, "/blog"]);
  }
}

export async function deleteBlogPostAction(formData: FormData) {
  await requireAdmin();
  const postId = Number(formData.get("postId"));
  if (!Number.isFinite(postId)) return;
  const post = await prisma.blogPost.delete({ where: { id: postId } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  redirect("/admin/blog");
}

export async function toggleBannerActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(id)) return;
  await prisma.banner.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

export async function toggleNoticeActiveAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  if (!Number.isFinite(id)) return;
  await prisma.notice.update({ where: { id }, data: { isActive: !isActive } });
  revalidatePath("/admin/notices");
  revalidatePath("/");
}

export async function createBannerAction(formData: FormData) {
  await requireAdmin();
  const imageFile = formData.get("imageFile");
  let image = String(formData.get("image") || "").trim();
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await saveUploadedImage(imageFile, "banner");
    if (uploaded) image = uploaded;
  }
  const link = String(formData.get("link") || "").trim();
  if (!image) return;

  const last = await prisma.banner.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.banner.create({
    data: { image, link: link || null, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });

  revalidatePath("/admin/banners");
  revalidatePath("/");
}

export async function deleteBannerAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await prisma.banner.delete({ where: { id } });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

export async function createNoticeAction(formData: FormData) {
  await requireAdmin();
  const message = String(formData.get("message") || "").trim();
  if (!message) return;

  await prisma.notice.create({ data: { message, isActive: true } });
  revalidatePath("/admin/notices");
  revalidatePath("/");
}

export async function sendBroadcastNotificationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAdmin();

  const parsed = broadcastNotificationSchema.safeParse({
    message: formData.get("message"),
    link: formData.get("link") || "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length > 0) {
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        actorId: session.user.id,
        type: "ADMIN_ANNOUNCEMENT" as const,
        message: parsed.data.message,
        link: parsed.data.link || null,
      })),
    });
  }

  revalidatePath("/admin/notices");
  return { success: true };
}

export async function updateSiteSettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = siteSettingsSchema.safeParse({
    siteName: formData.get("siteName"),
    tagline: formData.get("tagline"),
    metaTitle: formData.get("metaTitle") || "",
    metaDescription: formData.get("metaDescription") || "",
    metaKeywords: formData.get("metaKeywords") || "",
    whatsappNumber: formData.get("whatsappNumber"),
    telegramLink: formData.get("telegramLink") || "",
    facebookLink: formData.get("facebookLink") || "",
    contactEmail: formData.get("contactEmail"),
    bkashNumber: formData.get("bkashNumber"),
    nagadNumber: formData.get("nagadNumber"),
    rocketNumber: formData.get("rocketNumber"),
    referralBonusPercent: formData.get("referralBonusPercent"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  let ogImage: string | undefined;
  const ogImageFile = formData.get("ogImageFile");
  if (ogImageFile instanceof File && ogImageFile.size > 0) {
    try {
      const uploaded = await saveUploadedImage(ogImageFile, "og");
      if (uploaded) ogImage = uploaded;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "OG ইমেজ আপলোড ব্যর্থ হয়েছে" };
    }
  }

  let favicon: string | undefined;
  const faviconFile = formData.get("faviconFile");
  if (faviconFile instanceof File && faviconFile.size > 0) {
    try {
      const uploaded = await saveUploadedImage(faviconFile, "favicon");
      if (uploaded) favicon = uploaded;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Favicon আপলোড ব্যর্থ হয়েছে" };
    }
  }

  const iconUploads: Record<string, string> = {};
  for (const [field, prefix] of [
    ["bkashIconFile", "bkash-icon"],
    ["nagadIconFile", "nagad-icon"],
    ["rocketIconFile", "rocket-icon"],
    ["walletIconFile", "wallet-icon"],
  ] as const) {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      try {
        const uploaded = await saveUploadedIcon(file, prefix);
        if (uploaded) iconUploads[field.replace("File", "")] = uploaded;
      } catch (error) {
        return { error: error instanceof Error ? error.message : "আইকন আপলোড ব্যর্থ হয়েছে" };
      }
    }
  }

  const data = {
    ...parsed.data,
    metaTitle: parsed.data.metaTitle || null,
    metaDescription: parsed.data.metaDescription || null,
    metaKeywords: parsed.data.metaKeywords || null,
    telegramLink: parsed.data.telegramLink || "",
    facebookLink: parsed.data.facebookLink || null,
    allowGuestOrders: formData.get("allowGuestOrders") === "on",
    ...(ogImage ? { ogImage } : {}),
    ...(favicon ? { favicon } : {}),
    ...iconUploads,
  };

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { success: true };
}

const BLOCK_DURATION_DAYS: Record<string, number> = { "1": 1, "3": 3, "7": 7, "30": 30 };

export async function blockUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const duration = String(formData.get("duration") || "permanent");
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!userId) return;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || target.role === "ADMIN") return; // never block admins

  const days = BLOCK_DURATION_DAYS[duration];
  const blockedUntil = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

  await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: true, blockedUntil, blockReason: reason },
  });

  revalidatePath("/admin/users");
}

async function revalidateReviewProduct(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { product: { select: { id: true, slug: true } } },
  });
  if (review) revalidatePath(`/topup/${review.product.id}/${review.product.slug}`);
  return review?.product ?? null;
}

export async function approveReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const product = await revalidateReviewProduct(id);
  await prisma.review.update({ where: { id }, data: { isApproved: true } });
  revalidatePath("/admin/reviews");

  // A newly-approved review changes this product page's visible content and
  // its Product AggregateRating/Review JSON-LD — worth an immediate ping.
  if (product) {
    await submitToIndexNow(`/topup/${product.id}/${product.slug}`);
  }
}

export async function unapproveReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  await revalidateReviewProduct(id);
  await prisma.review.update({ where: { id }, data: { isApproved: false } });
  revalidatePath("/admin/reviews");
}

export async function deleteReviewAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  await revalidateReviewProduct(id);
  await prisma.review.delete({ where: { id } });
  revalidatePath("/admin/reviews");
}

export async function unblockUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: { isBlocked: false, blockedUntil: null, blockReason: null },
  });

  revalidatePath("/admin/users");
}
