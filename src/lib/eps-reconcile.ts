import { prisma } from "@/lib/prisma";
import { credentialsFrom, getPaymentGatewaySetting } from "@/lib/eps-client";
import { refreshEpsPayment, EPS_RECONCILE_WINDOW_MS } from "@/lib/eps-payments";

// Background safety net for EPS: a customer who pays and then closes the tab,
// loses signal, or whose browser never follows EPS's redirect back still gets
// their order/wallet credit, because this asks EPS about every unsettled
// payment on its own. Same in-process timer pattern as backup-scheduler.ts.

const TICK_MS = 60 * 1000;
const BATCH_SIZE = 25;
const RETRY_FAILED_FOR_MS = 2 * 60 * 60 * 1000;

const globalForReconciler = globalThis as unknown as {
  epsReconcileTimer?: NodeJS.Timeout;
  epsReconcileRunning?: boolean;
};

// How long to wait between checks of the same payment, by its age: often
// while the customer is likely still paying, then backing off.
function checkIntervalMs(ageMs: number) {
  if (ageMs < 15 * 60 * 1000) return 60 * 1000;
  if (ageMs < 2 * 60 * 60 * 1000) return 5 * 60 * 1000;
  return 30 * 60 * 1000;
}

export async function reconcileEpsPayments(): Promise<{ checked: number; settled: number; expired: number }> {
  if (globalForReconciler.epsReconcileRunning) return { checked: 0, settled: 0, expired: 0 };
  globalForReconciler.epsReconcileRunning = true;
  try {
    const setting = await getPaymentGatewaySetting();
    // Keep reconciling even with new checkouts switched off — payments
    // already in flight must still land.
    if (!credentialsFrom(setting)) return { checked: 0, settled: 0, expired: 0 };

    const now = Date.now();
    const cutoff = new Date(now - EPS_RECONCILE_WINDOW_MS);

    // Out of the window and never confirmed: stop polling. An admin can still
    // re-check any of these by hand from /admin/eps-payments.
    const expired = await prisma.epsPayment.updateMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
      data: { status: "EXPIRED" },
    });

    // FAILED/CANCELLED stay in the sweep too: a customer can retry inside the
    // same EPS session after a failed attempt and pay on the second go.
    const candidates = await prisma.epsPayment.findMany({
      // (only for their first two hours, so old ones never crowd out pending ones).
      where: {
        OR: [
          { status: "PENDING", createdAt: { gte: cutoff } },
          { status: { in: ["FAILED", "CANCELLED"] }, createdAt: { gte: new Date(now - RETRY_FAILED_FOR_MS) } },
        ],
      },
      // MySQL sorts NULL first ascending, so never-checked rows lead.
      orderBy: { lastCheckedAt: "asc" },
      take: BATCH_SIZE * 4,
      select: { id: true, status: true, createdAt: true, lastCheckedAt: true, redirectUrl: true },
    });

    let checked = 0;
    let settled = 0;
    for (const p of candidates) {
      if (checked >= BATCH_SIZE) break;
      // A session EPS never opened (initialize failed) only needs the odd look.
      const age = now - p.createdAt.getTime();
      const interval = p.redirectUrl ? checkIntervalMs(age) : 30 * 60 * 1000;
      // Failed/cancelled ones gently.
      const wait = p.status === "PENDING" ? interval : Math.max(interval, 5 * 60 * 1000);
      if (p.lastCheckedAt && now - p.lastCheckedAt.getTime() < wait) continue;

      checked++;
      try {
        const outcome = await refreshEpsPayment(p.id);
        if (outcome.kind === "settled") settled++;
      } catch (error) {
        console.error("[eps] reconcile of", p.id, "failed:", error);
      }
    }

    return { checked, settled, expired: expired.count };
  } finally {
    globalForReconciler.epsReconcileRunning = false;
  }
}

async function tick() {
  try {
    const result = await reconcileEpsPayments();
    if (result.settled > 0) console.log(`[eps] reconciler settled ${result.settled} payment(s)`);
  } catch (error) {
    // The timer must survive every failure.
    console.error("[eps] reconcile tick failed:", error);
  }
}

/** Safe to call more than once (dev hot reload); the timer lives on globalThis. */
export function startEpsReconciler() {
  if (globalForReconciler.epsReconcileTimer) return;
  const timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  globalForReconciler.epsReconcileTimer = timer;
  void tick();
}
