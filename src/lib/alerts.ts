import { prisma } from "@/lib/prisma";
import { splitDenomRecipe } from "@/lib/profit";

// Facebook Graph API version used for the Messenger Send API.
const GRAPH_VERSION = "v23.0";
const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAlertSetting() {
  const existing = await prisma.alertSetting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.alertSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

type SendResult = { ok: true } | { ok: false; error: string };

async function callSendApi(pageToken: string, body: Record<string, unknown>): Promise<SendResult> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(pageToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      }
    );
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends a text to one Messenger user from the Page. Meta only allows a normal
 * reply within 24 hours of that user's last message to the Page; after that
 * the ACCOUNT_UPDATE tag is tried instead.
 */
export async function sendMessengerText(
  pageToken: string,
  recipientId: string,
  text: string,
  lastInboundAt: Date | null
): Promise<SendResult> {
  const base = { recipient: { id: recipientId }, message: { text: text.slice(0, 2000) } };
  const insideWindow = lastInboundAt !== null && Date.now() - lastInboundAt.getTime() < DAY_MS;
  if (insideWindow) {
    const res = await callSendApi(pageToken, { ...base, messaging_type: "RESPONSE" });
    if (res.ok) return res;
  }
  return callSendApi(pageToken, { ...base, messaging_type: "MESSAGE_TAG", tag: "ACCOUNT_UPDATE" });
}

/** Sends an alert to the connected admin and records the outcome. */
export async function sendAdminAlert(text: string): Promise<SendResult> {
  const setting = await getAlertSetting();
  if (!setting.messengerPageToken || !setting.messengerRecipientId) {
    return { ok: false, error: "Messenger সংযুক্ত করা নেই" };
  }
  const result = await sendMessengerText(
    setting.messengerPageToken,
    setting.messengerRecipientId,
    text,
    setting.messengerLastInboundAt
  );
  await prisma.alertSetting.update({
    where: { id: 1 },
    data: result.ok
      ? { messengerLastSentAt: new Date(), messengerLastError: null }
      : { messengerLastError: result.error },
  });
  return result;
}

export type DenomStock = { denom: string; unused: number };

/** Unused code count for every denom a UniPin package uses or that has codes. */
export async function getUnipinStockLevels(): Promise<DenomStock[]> {
  const [unusedByDenom, allDenoms, options] = await Promise.all([
    prisma.unipinCode.groupBy({ by: ["denom"], where: { status: "UNUSED" }, _count: { _all: true } }),
    prisma.unipinCode.groupBy({ by: ["denom"] }),
    prisma.rechargeOption.findMany({
      where: { deliveryMethod: "UNIPIN", isActive: true, denom: { not: null } },
      select: { denom: true },
    }),
  ]);
  const unused = new Map(unusedByDenom.map((r) => [r.denom, r._count._all]));
  const denoms = new Set(allDenoms.map((r) => r.denom));
  for (const option of options) for (const token of splitDenomRecipe(option.denom)) denoms.add(token);
  return [...denoms]
    .map((denom) => ({ denom, unused: unused.get(denom) ?? 0 }))
    .sort((a, b) => a.denom.localeCompare(b.denom, undefined, { numeric: true }));
}

/**
 * Alerts the admin once for every denom whose unused stock fell below the
 * threshold, and re-arms denoms that were restocked. Safe to call often and
 * concurrently: the UnipinStockAlert primary key lets only one caller claim
 * each denom's alert.
 */
export async function checkUnipinLowStock(): Promise<{ newlyLow: DenomStock[]; sent: boolean }> {
  const setting = await getAlertSetting();
  if (!setting.lowStockEnabled) return { newlyLow: [], sent: false };

  const levels = await getUnipinStockLevels();
  const threshold = setting.lowStockThreshold;
  const low = levels.filter((l) => l.unused < threshold);

  await prisma.unipinStockAlert.deleteMany({
    where: { denom: { notIn: low.map((l) => l.denom) } },
  });

  const newlyLow: DenomStock[] = [];
  for (const level of low) {
    const claimed = await prisma.unipinStockAlert.createMany({
      data: [{ denom: level.denom, unused: level.unused }],
      skipDuplicates: true,
    });
    if (claimed.count > 0) newlyLow.push(level);
  }
  if (newlyLow.length === 0) return { newlyLow, sent: false };

  const lines = newlyLow.map((l) => `• Denom ${l.denom}: ${l.unused === 0 ? "স্টক শেষ (0)" : `বাকি ${l.unused}টি`}`);
  const text = `⚠️ UniPin স্টক কম (${threshold}টির নিচে)\n${lines.join("\n")}\n\nদ্রুত কোড যোগ করুন: Admin → Unipin`;
  const result = await sendAdminAlert(text);
  if (!result.ok) {
    // Let the next check retry instead of silently swallowing the alert.
    await prisma.unipinStockAlert.deleteMany({ where: { denom: { in: newlyLow.map((l) => l.denom) } } });
  }
  return { newlyLow, sent: result.ok };
}

/** Fire-and-forget wrapper for call sites that must not wait or fail on alerts. */
export function queueUnipinLowStockCheck() {
  void checkUnipinLowStock().catch((error) => console.error("[alerts] low stock check failed:", error));
}
