"use server";

import { prisma } from "@/lib/prisma";
import { lookupFFName, isValidFFNameUid, type FFNameResult } from "@/lib/ffname-client";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Anyone browsing a product can call this — guests order too — and every call
// spends a request against a paid third-party API. Cap it per IP so a script
// can't drain the quota by hammering the endpoint.
const LOOKUPS_PER_MINUTE = 20;

/**
 * Resolves a player's in-game name for the checkout field.
 *
 * Gated on the product actually having name check switched on, so the lookup
 * can't be driven from a product that never offers it.
 */
export async function checkPlayerNameAction(productId: number, uid: string): Promise<FFNameResult> {
  if (!isValidFFNameUid(uid)) return { ok: false, error: "আইডি সঠিক নয়" };

  const ip = await getClientIp();
  if (!checkRateLimit(`name-check:${ip}`, LOOKUPS_PER_MINUTE, 60_000)) {
    return { ok: false, error: "একটু পরে আবার চেষ্টা করুন" };
  }

  const [product, apiSetting] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { nameCheckEnabled: true } }),
    prisma.apiSetting.findFirst({ where: { type: "FFNAME", isActive: true } }),
  ]);

  if (!product?.nameCheckEnabled) return { ok: false, error: "এই প্রোডাক্টে নেম চেক নেই" };

  return lookupFFName({ baseUrl: apiSetting?.endpoint ?? null, apiKey: apiSetting?.apiKey ?? null, uid });
}
