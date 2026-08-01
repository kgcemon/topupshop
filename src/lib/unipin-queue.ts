import { prisma } from "@/lib/prisma";
import { claimUnipinCodes } from "@/lib/unipin-fulfillment";
import { redeemUnipinCode } from "@/lib/unipin-client";
import type { FulfillmentResult } from "@/lib/order-fulfillment";

// Ensures a fulfillment job row exists for this order. `orderId` is unique on
// FulfillmentJob, so calling this any number of times for the same order —
// a fresh approval, a retried approval, a retried request — creates at most
// one job and never resets an existing one's progress (attempts/lastError/
// status are left untouched by the `update: {}` branch).
export async function enqueueUnipinFulfillmentJob(orderId: string) {
  await prisma.fulfillmentJob.upsert({
    where: { orderId },
    create: { orderId },
    update: {},
  });
}

// Processes one order's UniPin fulfillment job:
//   1. Atomically claim exactly the codes the order's denom recipe needs
//      from local stock (never purchases more — see claimUnipinCodes).
//   2. Call the UniPin redeem API once per claimed code that hasn't
//      succeeded yet (e.g. a "7+3" order calls it twice, once per code).
// Safe to call repeatedly for the same order: a code that already redeemed
// successfully is never resubmitted, and the job's own PENDING/FAILED-only
// claim below means two concurrent calls can never both process it at once.
export async function processUnipinFulfillmentJob(orderId: string): Promise<FulfillmentResult> {
  const job = await prisma.fulfillmentJob.findUnique({ where: { orderId } });
  if (!job) return { status: "not-applicable" };

  const claimed = await prisma.fulfillmentJob.updateMany({
    where: { id: job.id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING", processingAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    // Either another call is processing this job right now, or it already
    // completed — in both cases, don't process it again here.
    return { status: "already-fulfilled" };
  }

  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { rechargeOption: true },
    });

    const claimResult = await claimUnipinCodes(orderId);

    if (claimResult.status === "not-applicable") {
      // Not a terminal state: the recharge option's denom recipe can be
      // configured/edited after this order was placed (see
      // updateRechargeOptionDenomAction). Marking the job COMPLETED here
      // would permanently block reprocessing — since orderId is unique on
      // FulfillmentJob, a later approval resubmit would find this COMPLETED
      // job, skip it, and report "already-fulfilled" without ever claiming
      // or redeeming a code once the recipe finally exists. Deleting the job
      // instead means a future approval starts a fresh one.
      await prisma.fulfillmentJob.delete({ where: { id: job.id } });
      return { status: "not-applicable" };
    }

    if (claimResult.status === "insufficient") {
      await prisma.fulfillmentJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lastError: "Insufficient local unused stock" },
      });
      return { status: "insufficient" };
    }

    // A non-empty but wrong-sized/wrong-mix set of linked codes was found —
    // should be structurally impossible given claimUnipinCodes' all-or-
    // nothing transaction, but this is the hard stop that guarantees the
    // redeem API is NEVER called unless the exact required set is verified
    // present. Never auto-heal this by claiming more or discarding codes —
    // it needs a human to look at the order's linked codes directly.
    if (claimResult.status === "count-mismatch") {
      const message = `Linked code count mismatch for order ${orderId}: found ${claimResult.codes.length}, expected ${claimResult.expected} — refusing to call the redeem API, needs manual review`;
      await prisma.fulfillmentJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: message } });
      return { status: "failed", error: message };
    }

    // claimed or already-claimed — either way, we've just verified the
    // linked set exactly matches the recipe, so it's safe to redeem
    // whichever of this order's codes haven't succeeded yet.
    const apiSetting = await prisma.apiSetting.findFirst({ where: { type: "UNIPIN", isActive: true } });

    let lastError: string | undefined;
    for (const code of claimResult.codes) {
      if (code.redeemedAt) continue; // already redeemed on a previous attempt — never call the API twice for the same code

      if (!apiSetting?.endpoint) {
        lastError = "UniPin API config নেই (active endpoint সেট করা নেই)";
        continue;
      }

      const result = await redeemUnipinCode({
        apiSettingId: apiSetting.id,
        endpoint: apiSetting.endpoint,
        apiKey: apiSetting.apiKey,
        apiSecret: apiSetting.apiSecret,
        denom: code.denom,
        code: code.code,
        playerId: order.playerId,
        orderId: order.id,
      });

      if (result.success) {
        await prisma.unipinCode.update({ where: { id: code.id }, data: { redeemedAt: new Date() } });
      } else {
        lastError = result.error;
      }
    }

    if (!lastError) {
      await prisma.fulfillmentJob.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
      return { status: "fulfilled" };
    }

    await prisma.fulfillmentJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError } });
    return { status: "failed", error: lastError };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.fulfillmentJob
      .update({ where: { id: job.id }, data: { status: "FAILED", lastError: message } })
      .catch(() => {});
    throw error;
  }
}
