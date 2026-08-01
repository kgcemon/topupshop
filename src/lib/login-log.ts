import { prisma } from "@/lib/prisma";
import { lookupIpLocation } from "@/lib/geo";

const MAX_LOGIN_LOGS_PER_USER = 20;

/**
 * Records a successful login: creates a LoginLog row, bumps the user's
 * all-time counters, and prunes older LoginLog rows beyond the most recent
 * 20 for this user so the table can't grow unbounded. The 20-row cap only
 * applies to this activity log — the User row and its orders/wallet history
 * are never touched here.
 */
export async function recordLoginActivity({
  userId,
  provider,
  ip,
}: {
  userId: string;
  provider: "credentials" | "google";
  ip: string;
}): Promise<void> {
  const location = await lookupIpLocation(ip);

  await prisma.$transaction(async (tx) => {
    await tx.loginLog.create({
      data: { userId, provider, ip, location },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        loginCount: { increment: 1 },
        lastLoginAt: new Date(),
        ...(location ? { lastLoginLocation: location } : {}),
      },
    });

    const stale = await tx.loginLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: MAX_LOGIN_LOGS_PER_USER,
      select: { id: true },
    });
    if (stale.length > 0) {
      await tx.loginLog.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }
  });
}

export async function getLoginHistory(userId: string, limit = MAX_LOGIN_LOGS_PER_USER) {
  return prisma.loginLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
