"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  blogPostFormSchema,
  productFormSchema,
  siteSettingsSchema,
  sectionFormSchema,
  broadcastNotificationSchema,
  changePasswordSchema,
  createManagerSchema,
} from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { saveUploadedImage, saveUploadedIcon } from "@/lib/upload";
import { grantFirstOrderReferralBonus } from "@/lib/referral";
import { createNotification } from "@/lib/notifications";
import { formatOrderNumber } from "@/lib/utils";
import { processOrderFulfillment } from "@/lib/order-fulfillment";
import { submitToIndexNow } from "@/lib/indexnow";
import { sendOrderDeliveredEmail, sendOrderCancelledEmail, sendWalletTopupEmail, sendTestMail } from "@/lib/mailer";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

// Orders are the one area a MANAGER is allowed to touch (view + status change) —
// everything else in the admin panel stays ADMIN-only via requireAdmin() above.
async function requireStaff() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
    throw new Error("Unauthorized: admin or manager access required");
  }
  return session;
}

export async function updateOrderStatusAction(formData: FormData) {
  const session = await requireStaff();

  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as
    | "APPROVED"
    | "RUNNING"
    | "REJECTED"
    | "DELIVERED"
    | "CANCELLED"
    | "AUTO_FAILED";
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
        include: { rechargeOption: true, user: true },
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

  const { isRefundableRejection } = await prisma.$transaction(async (tx) => {
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

      if (enteringCancelledOrRejected) {
        await createNotification(tx, {
          userId: order.userId,
          actorId: session.user.id,
          type: "ORDER_NOTE",
          message: isRefundableRejection
            ? `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} বাতিল করা হয়েছে। ৳${order.amount} আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।`
            : `আপনার অর্ডার ${formatOrderNumber(order.orderSerial)} বাতিল করা হয়েছে।`,
          link: "/dashboard/orders",
        });
      }
    }

    return { isRefundableRejection };
  });

  // Best-effort, outside the transaction — mirrors processOrderFulfillment
  // above, never let a slow/broken SMTP server hold DB locks or fail the
  // status update it's just confirming.
  if (enteringDelivered) {
    await sendOrderDeliveredEmail(order.user?.email, {
      orderNumber: formatOrderNumber(order.orderSerial),
      amount: order.amount,
    });
  }
  if (enteringCancelledOrRejected) {
    await sendOrderCancelledEmail(order.user?.email, {
      orderNumber: formatOrderNumber(order.orderSerial),
      amount: order.amount,
      refunded: isRefundableRejection,
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");

  const params = new URLSearchParams({ status: redirectStatus });
  if (redirectQuery) params.set("q", redirectQuery);
  redirect(`/admin/orders?${params.toString()}`);
}

function orderRedirectHref(formData: FormData) {
  const redirectStatus = String(formData.get("redirectStatus") || "ALL");
  const redirectQuery = String(formData.get("redirectQuery") || "");
  const params = new URLSearchParams({ status: redirectStatus });
  if (redirectQuery) params.set("q", redirectQuery);
  return `/admin/orders?${params.toString()}`;
}

export async function deleteOrderAction(formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  const href = orderRedirectHref(formData);
  if (!orderId) redirect(href);

  await prisma.order.delete({ where: { id: orderId } }).catch(() => null);

  revalidatePath("/admin/orders");
  redirect(href);
}

export async function deleteOrdersAction(formData: FormData) {
  await requireAdmin();
  const orderIds = formData.getAll("orderIds").map(String).filter(Boolean);
  const href = orderRedirectHref(formData);

  if (orderIds.length > 0) {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  revalidatePath("/admin/orders");
  redirect(href);
}

export async function updateWalletTransactionAction(formData: FormData) {
  const session = await requireAdmin();

  const txId = String(formData.get("transactionId"));
  const status = String(formData.get("status")) as "APPROVED" | "REJECTED";

  const { approvedDeposit } = await prisma.$transaction(async (tx) => {
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

    const walletTx = await tx.walletTransaction.findUniqueOrThrow({
      where: { id: txId },
      include: { user: true },
    });
    const isApprovedDeposit = status === "APPROVED" && walletTx.type === "DEPOSIT";
    if (isApprovedDeposit) {
      await tx.user.update({
        where: { id: walletTx.userId },
        data: { walletBalance: { increment: walletTx.amount } },
      });
    }

    return { approvedDeposit: isApprovedDeposit ? walletTx : null };
  });

  // Best-effort, outside the transaction — see the same pattern in
  // updateOrderStatusAction above.
  if (approvedDeposit) {
    await sendWalletTopupEmail(approvedDeposit.user.email, { amount: approvedDeposit.amount });
  }

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

export async function updateRechargeOptionPriceAction(formData: FormData) {
  await requireAdmin();
  const optionId = Number(formData.get("optionId"));
  const productId = formData.get("productId");
  const price = Number(formData.get("price"));

  if (!Number.isFinite(optionId) || !Number.isFinite(price) || price < 0) return;

  await prisma.rechargeOption.update({
    where: { id: optionId },
    data: { price },
  });

  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/");
}

// Swaps the option with its previous/next sibling (ordered by sortOrder,
// then id as a tiebreak for pre-existing rows that share sortOrder 0) and
// re-numbers the whole list 0..n-1. Re-numbering everyone rather than just
// the two swapped rows also normalizes any leftover ties/gaps, so ordering
// stays well-defined for every future move.
export async function moveRechargeOptionAction(formData: FormData) {
  await requireAdmin();
  const optionId = Number(formData.get("optionId"));
  const productId = Number(formData.get("productId"));
  const direction = String(formData.get("direction") || "");
  if (!Number.isFinite(optionId) || !Number.isFinite(productId)) return;
  if (direction !== "up" && direction !== "down") return;

  const options = await prisma.rechargeOption.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const index = options.findIndex((option) => option.id === optionId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= options.length) return;

  const reordered = [...options];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  await prisma.$transaction(
    reordered.map((option, i) => prisma.rechargeOption.update({ where: { id: option.id }, data: { sortOrder: i } }))
  );

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
    inputLabel: formData.get("inputLabel") || "",
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
      inputLabel: parsed.data.inputLabel || null,
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
      inputLabel: parsed.data.inputLabel || null,
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
    smtpHost: formData.get("smtpHost") || "",
    smtpPort: formData.get("smtpPort") || "",
    smtpUser: formData.get("smtpUser") || "",
    smtpFromEmail: formData.get("smtpFromEmail") || "",
    smtpFromName: formData.get("smtpFromName") || "",
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

  // Kept at its original dimensions (not icon-resized) — a logo is wide, not square.
  let logo: string | undefined;
  const logoFile = formData.get("logoFile");
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      const uploaded = await saveUploadedImage(logoFile, "logo");
      if (uploaded) logo = uploaded;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "লোগো আপলোড ব্যর্থ হয়েছে" };
    }
  }

  let favicon: string | undefined;
  const faviconFile = formData.get("faviconFile");
  if (faviconFile instanceof File && faviconFile.size > 0) {
    try {
      const uploaded = await saveUploadedIcon(faviconFile, "favicon");
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

  const smtpPassword = String(formData.get("smtpPassword") || "").trim();

  const data = {
    ...parsed.data,
    metaTitle: parsed.data.metaTitle || null,
    metaDescription: parsed.data.metaDescription || null,
    metaKeywords: parsed.data.metaKeywords || null,
    telegramLink: parsed.data.telegramLink || "",
    facebookLink: parsed.data.facebookLink || null,
    allowGuestOrders: formData.get("allowGuestOrders") === "on",
    showHomeProducts: formData.get("showHomeProducts") === "on",
    depositEnabled: formData.get("depositEnabled") === "on",
    smtpEnabled: formData.get("smtpEnabled") === "on",
    smtpSecure: formData.get("smtpSecure") === "on",
    smtpHost: parsed.data.smtpHost || null,
    smtpPort: parsed.data.smtpPort ?? 587,
    smtpUser: parsed.data.smtpUser || null,
    smtpFromEmail: parsed.data.smtpFromEmail || null,
    smtpFromName: parsed.data.smtpFromName || null,
    // Leave the stored password untouched unless the admin typed a new one —
    // the form never prefills this field, so an empty submit means "keep it".
    ...(smtpPassword ? { smtpPassword } : {}),
    ...(ogImage ? { ogImage } : {}),
    ...(favicon ? { favicon } : {}),
    ...(logo ? { logo } : {}),
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

export async function sendTestEmailAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const testEmail = String(formData.get("testEmail") || "").trim();
  if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
    return { error: "সঠিক একটি ইমেইল ঠিকানা দিন।" };
  }

  const result = await sendTestMail(testEmail);
  if (!result.success) {
    return { error: result.error };
  }

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
  if (!target || target.role === "ADMIN" || target.role === "MANAGER") return; // never block admins/managers

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

// Available to both ADMIN and MANAGER — each admin-panel account manages its
// own password rather than admins being able to set a manager's password.
export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireStaff();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.password) {
    return { error: "এই একাউন্টে কোনো পাসওয়ার্ড সেট নেই (Google দিয়ে সাইন ইন করা)।" };
  }

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!isValid) {
    return { fieldErrors: { currentPassword: "বর্তমান পাসওয়ার্ড সঠিক নয়" } };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: session.user.id }, data: { password: hashedPassword } });

  return { success: true };
}

export async function createManagerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createManagerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { fieldErrors: { email: "এই ইমেইল দিয়ে ইতিমধ্যে একাউন্ট আছে" } };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password: hashedPassword,
      role: "MANAGER",
    },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function removeManagerAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  await prisma.user.updateMany({
    where: { id: userId, role: "MANAGER" },
    data: { role: "USER" },
  });

  revalidatePath("/admin/users");
}
