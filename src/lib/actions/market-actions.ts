"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketListingFormSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/actions/auth-actions";
import { saveUploadedImage } from "@/lib/upload";

const MAX_IMAGES = 5;

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
      const path = await saveUploadedImage(file, "market");
      if (path) uploaded.push(path);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "ইমেজ আপলোড ব্যর্থ হয়েছে" };
    }
  }
  return uploaded;
}

export async function createMarketListingAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "পোস্ট করতে লগইন করুন।" };
  }

  const setting = await prisma.siteSetting.findUnique({ where: { id: 1 }, select: { marketEnabled: true } });
  if (setting && !setting.marketEnabled) {
    return { error: "মার্কেট ফিচারটি বর্তমানে বন্ধ আছে।" };
  }

  const parsed = marketListingFormSchema.safeParse({
    game: formData.get("game"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    contactNumber: formData.get("contactNumber") || "",
    whatsappNumber: formData.get("whatsappNumber") || "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const images = await uploadListingImages(formData);
  if (!Array.isArray(images)) {
    return { fieldErrors: { images: images.error } };
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
