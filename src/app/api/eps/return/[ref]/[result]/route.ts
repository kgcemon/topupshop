import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshEpsPayment } from "@/lib/eps-payments";

// Where EPS sends the customer back after paying (successUrl), failing
// (failUrl) or cancelling (cancelUrl) — the ref in the path is ours, set in
// startEpsPayment. Whatever EPS appends to the query string is ignored: the
// payment is verified server to server with EPS before anything is credited.
//
// This route never errors out at the customer. A bad ref, an expired EPS
// token, EPS being slow — every case lands on the status page, which keeps
// checking on its own; the background reconciler is the backstop behind it.

const RESULTS = new Set(["success", "fail", "cancel"]);

// Behind a reverse proxy request.nextUrl is the internal address; send the
// customer back to the host they actually came in on.
function publicOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

async function handle(request: NextRequest, ctx: { params: Promise<{ ref: string; result: string }> }) {
  const { ref, result } = await ctx.params;
  const statusPage = new URL(`/payment/eps/${encodeURIComponent(ref)}`, publicOrigin(request));

  if (/^[a-f0-9]{32}$/.test(ref) && RESULTS.has(result)) {
    const payment = await prisma.epsPayment
      .findUnique({ where: { ref }, select: { id: true, lastCheckedAt: true } })
      .catch(() => null);
    // A reload or a replayed link within a few seconds needn't ask EPS again —
    // the status page polls anyway.
    const justChecked = result === "success" && payment?.lastCheckedAt && Date.now() - payment.lastCheckedAt.getTime() < 3000;
    if (payment && !justChecked) {
      try {
        await refreshEpsPayment(payment.id, { hint: result as "success" | "fail" | "cancel" });
      } catch (error) {
        console.error("[eps] return-url check failed:", error);
      }
    }
  }

  // 303 so a POST-back from EPS turns into a plain GET of the status page.
  return NextResponse.redirect(statusPage, 303);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ ref: string; result: string }> }) {
  return handle(request, ctx);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ ref: string; result: string }> }) {
  return handle(request, ctx);
}
