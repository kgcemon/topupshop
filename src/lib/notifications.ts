import type { Prisma } from "@/generated/prisma/client";

/**
 * Creates a notification for a user. `message` must always be plain text — it is
 * rendered as a JSX text node (never dangerouslySetInnerHTML), so even if it contains
 * user-supplied text (e.g. someone's display name), React escapes it automatically
 * and it can never execute as a script.
 */
export async function createNotification(
  client: Prisma.TransactionClient,
  params: {
    userId: string;
    actorId?: string | null;
    type: "COMMENT_REPLY" | "COMMENT_LIKE" | "ORDER_COMPLETED" | "ORDER_NOTE" | "ORDER_FULFILLMENT_ISSUE";
    message: string;
    link?: string | null;
  }
) {
  if (params.actorId && params.actorId === params.userId) return; // never notify yourself

  await client.notification.create({
    data: {
      userId: params.userId,
      actorId: params.actorId ?? null,
      type: params.type,
      message: params.message,
      link: params.link ?? null,
    },
  });
}

/**
 * Notifies every admin user — used for system-triggered alerts (e.g. an
 * order's delivery API failed or had insufficient stock/config) that don't
 * target one specific customer. Unlike createNotification, this never skips
 * on actorId === userId — other admins still need to see the alert even if
 * the triggering admin is also one of the recipients.
 */
export async function notifyAdmins(
  client: Prisma.TransactionClient,
  params: {
    actorId?: string | null;
    type: "ORDER_FULFILLMENT_ISSUE" | "ORDER_PAYMENT_MISMATCH" | "PAYMENT_SMS_BALANCE_MISMATCH";
    message: string;
    link?: string | null;
  }
) {
  const admins = await client.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;

  await client.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      actorId: params.actorId ?? null,
      type: params.type,
      message: params.message,
      link: params.link ?? null,
    })),
  });
}
