import { prisma } from "@/lib/prisma";

const ABUSE_BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

const MALICIOUS_PATTERNS: RegExp[] = [
  /<script\b/i,
  /<\/script>/i,
  /<iframe\b/i,
  /javascript:/i,
  /on(error|load|click|mouseover|focus)\s*=/i,
  /union\s+select/i,
  /drop\s+table/i,
  /insert\s+into/i,
  /delete\s+from/i,
  /'\s*or\s*'1'\s*=\s*'1/i,
  /--\s*$/,
  /;\s*(drop|delete|shutdown)\b/i,
  /`[^`]*`/, // shell backtick substitution
  /\$\([^)]*\)/, // shell $() substitution
  /\brm\s+-rf\b/i,
  /\b(wget|curl)\s+https?:\/\//i,
  /\bchmod\s+\+x\b/i,
  /\.\.\/\.\.\//, // path traversal
];

/**
 * True if any of the given free-text inputs looks like a script/SQL/shell
 * injection attempt. Used to gate public forms (register, order, comments).
 */
export function detectMaliciousInput(...values: (string | undefined | null)[]): boolean {
  return values.some((value) => {
    if (!value) return false;
    return MALICIOUS_PATTERNS.some((pattern) => pattern.test(value));
  });
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  const block = await prisma.ipBlock.findUnique({ where: { ip } });
  return !!block && block.blockedUntil > new Date();
}

/**
 * Blocks the acting entity for 24h: the user's account if logged in
 * (reusing the existing isBlocked/blockedUntil/blockReason fields — same
 * mechanism as the admin's manual block control), otherwise their IP.
 * Never blocks admins, mirroring blockUserAction's existing invariant.
 */
export async function applyAbuseBlock({
  userId,
  ip,
  reason,
}: {
  userId: string | null;
  ip: string;
  reason: string;
}): Promise<void> {
  const blockedUntil = new Date(Date.now() + ABUSE_BLOCK_DURATION_MS);

  if (userId) {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target || target.role === "ADMIN") return;

    await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true, blockedUntil, blockReason: reason },
    });
    return;
  }

  if (!ip || ip === "unknown") return;
  await prisma.ipBlock.upsert({
    where: { ip },
    create: { ip, reason, blockedUntil },
    update: { reason, blockedUntil },
  });
}
