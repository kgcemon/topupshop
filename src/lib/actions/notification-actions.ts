"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationReadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = String(formData.get("notificationId"));
  const link = String(formData.get("link") || "");

  // Scoped to userId so a user can only ever mark their own notifications as read.
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");
  if (link) redirect(link);
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/", "layout");
}
