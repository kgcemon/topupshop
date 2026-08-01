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
    type: "COMMENT_REPLY" | "COMMENT_LIKE" | "ORDER_COMPLETED" | "ORDER_NOTE";
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
