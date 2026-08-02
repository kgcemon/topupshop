"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketListingFormSchema, marketOfferFormSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { saveUploadedListingPhoto } from "@/lib/upload";

const MAX_IMAGES = 5;

export type MarketActionState = ActionState & {
  values?: {
    game?: string;
    title?: string;
    description?: string;
    price?: string;
    contactNumber?: string;
    whatsappNumber?: string;
  };
};

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: admin access required");
  }
  return session;
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

async function uploadListingImages(formData: FormData): Promise<string[] | { error: string }> {
  const files = formData.getAll("imageFiles").filter((f): f is File => f instanceof File && f.size > 0);
  const uploaded: string[] = [];
  for (const file of files.slice(0, MAX_IMAGES)) {
    try {
      const path = await saveUploadedListingPhoto(file, "market");
      if (path) uploaded.push(path);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ইমেজ আপলোড ব্যর্থ হয়েছে" };
    }
  }
  return uploaded;
}

export async function createMarketListingAction(
  _prevState: MarketActionState,
  formData: FormData
): Promise<MarketActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "পোস্ট করতে লগইন করুন।" };
  }

  const setting = await prisma.siteSetting.findUnique({ where: { id: 1 }, select: { marketEnabled: true } });
  if (setting && !setting.marketEnabled) {
    return { error: "মার্কেট ফিচারটি বর্তমানে বন্ধ আছে।" };
  }

  const rawValues = {
    game: String(formData.get("game") || ""),
    title: String(formData.get("title") || ""),
    description: String(formData.get("description") || ""),
    price: String(formData.get("price") || ""),
    contactNumber: String(formData.get("contactNumber") || ""),
    whatsappNumber: String(formData.get("whatsappNumber") || ""),
  };

  const parsed = marketListingFormSchema.safeParse({
    game: formData.get("game"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    contactNumber: formData.get("contactNumber") || "",
    whatsappNumber: formData.get("whatsappNumber") || "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: rawValues };
  }

  const images = await uploadListingImages(formData);
  if (!Array.isArray(images)) {
    return { fieldErrors: { images: images.error }, values: rawValues };
  }

  await prisma.marketListing.create({
    data: {
      sellerId: session.user.id,
      game: parsed.data.game,
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      images,
      contactNumber: parsed.data.contactNumber || null,
      whatsappNumber: parsed.data.whatsappNumber || null,
    },
  });

  revalidatePath("/market");
  revalidatePath("/dashboard/market");
  revalidatePath("/admin/market");
  redirect("/dashboard/market");
}

export async function deleteOwnMarketListingAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.marketListing.deleteMany({ where: { id, sellerId: session.user.id } });

  revalidatePath("/market");
  revalidatePath("/dashboard/market");
  revalidatePath("/admin/market");
}

export async function markOwnListingSoldAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.marketListing.updateMany({
    where: { id, sellerId: session.user.id },
    data: { status: "SOLD" },
  });

  revalidatePath("/market");
  revalidatePath("/dashboard/market");
  revalidatePath("/admin/market");
}

export async function approveMarketListingAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.marketListing.update({
    where: { id },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
  });

  revalidatePath("/market");
  revalidatePath("/dashboard/market");
  revalidatePath("/admin/market");
}

export async function rejectMarketListingAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "");
  const adminNote = String(formData.get("adminNote") || "").trim();
  if (!id) return;

  await prisma.marketListing.update({
    where: { id },
    data: {
      status: "REJECTED",
      adminNote: adminNote || null,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/market");
  revalidatePath("/dashboard/market");
  revalidatePath("/admin/market");
}

export async function deleteMarketListingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  await prisma.marketListing.delete({ where: { id } });

  revalidatePath("/market");
  revalidatePath("/dashboard/market");
  revalidatePath("/admin/market");
}

export type MarketOfferActionState = ActionState & {
  success?: boolean;
  values?: { offerPrice?: string; message?: string };
};

export async function createMarketOfferAction(
  _prevState: MarketOfferActionState,
  formData: FormData
): Promise<MarketOfferActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "অফার পাঠাতে লগইন করুন।" };
  }

  const rawValues = {
    offerPrice: String(formData.get("offerPrice") || ""),
    message: String(formData.get("message") || ""),
  };

  const parsed = marketOfferFormSchema.safeParse({
    listingId: formData.get("listingId"),
    offerPrice: formData.get("offerPrice"),
    message: formData.get("message") || "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: rawValues };
  }

  const listing = await prisma.marketListing.findUnique({
    where: { id: parsed.data.listingId },
    select: { id: true, status: true, sellerId: true },
  });
  if (!listing || listing.status !== "APPROVED") {
    return { error: "এই লিস্টিংটি বর্তমানে অফারের জন্য উপলব্ধ নয়।", values: rawValues };
  }
  if (listing.sellerId === session.user.id) {
    return { error: "নিজের লিস্টিংয়ে নিজে অফার করা যাবে না।", values: rawValues };
  }

  await prisma.marketOffer.create({
    data: {
      listingId: listing.id,
      buyerId: session.user.id,
      offerPrice: parsed.data.offerPrice,
      message: parsed.data.message || null,
    },
  });

  revalidatePath(`/market/${listing.id}`);
  revalidatePath("/admin/market");
  return { success: true };
}

export async function respondToMarketOfferAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || (status !== "ACCEPTED" && status !== "REJECTED")) return;

  const offer = await prisma.marketOffer.update({
    where: { id },
    data: { status, respondedById: session.user.id, respondedAt: new Date() },
    select: { listingId: true },
  });

  revalidatePath(`/market/${offer.listingId}`);
  revalidatePath("/admin/market");
}

export async function toggleMarketEnabledAction(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("enabled") === "true";

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: { id: 1, marketEnabled: !enabled },
    update: { marketEnabled: !enabled },
  });

  revalidatePath("/", "layout");
  revalidatePath("/market");
  revalidatePath("/admin/market");
}
