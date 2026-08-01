import { logApiCall } from "@/lib/api-log";

type RedeemResult = { success: true } | { success: false; error: string };

// Fixed Telegram bot id the UniPin reseller API expects on every redeem
// request — not a secret, just a routing id for their own notifications.
const UNIPIN_TG_BOT_ID = "701657976";

// Submits an already-owned UniPin code (claimed from local stock — see
// unipin-fulfillment.ts) to be applied to a player's account. This never
// purchases/generates a new code; it only redeems one we already hold.
// Confirmed request/response contract:
//   request:  { playerid, pacakge, code, orderid, url, tgbotid, ourstock }
//   success:  { status: "success", content, nickname, orderid }
//   failure:  { status: "failed", content, orderid, shell_balance, playerid }
// Some UniPin deployments answer this synchronously; others only resolve
// via the `url` callback (see src/app/api/unipin/callback/route.ts), which
// applies the exact same success/failure outcome — whichever arrives first
// (or both) is handled idempotently.
export async function redeemUnipinCode(params: {
  apiSettingId: number;
  endpoint: string;
  apiKey: string | null;
  apiSecret: string | null;
  denom: string;
  code: string;
  playerId: string;
  orderId: string;
  orderSerial: number;
  callbackUrl: string;
}): Promise<RedeemResult> {
  const body = {
    playerid: params.playerId,
    pacakge: params.denom,
    code: params.code,
    orderid: params.orderSerial,
    url: params.callbackUrl,
    tgbotid: UNIPIN_TG_BOT_ID,
    ourstock: 1,
  };
  const requestBody = JSON.stringify(body);

  let response: Response;
  try {
    response = await fetch(params.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(params.apiKey ? { "X-Api-Key": params.apiKey } : {}),
        ...(params.apiSecret ? { "X-Api-Secret": params.apiSecret } : {}),
      },
      body: requestBody,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    await logApiCall({
      orderId: params.orderId,
      apiSettingId: params.apiSettingId,
      deliveryMethod: "UNIPIN",
      denom: params.denom,
      requestBody,
      errorMessage: message,
      success: false,
    });
    return { success: false, error: message };
  }

  const text = await response.text();

  // Determine the true final outcome before logging, so `success`/
  // `errorMessage` always reflect what actually happened rather than just
  // the HTTP status.
  const result: RedeemResult = !response.ok
    ? { success: false, error: `HTTP ${response.status}` }
    : parseRedeemResponse(text);

  await logApiCall({
    orderId: params.orderId,
    apiSettingId: params.apiSettingId,
    deliveryMethod: "UNIPIN",
    denom: params.denom,
    requestBody,
    responseBody: text,
    statusCode: response.status,
    errorMessage: result.success ? undefined : result.error,
    success: result.success,
  });

  return result;
}

// Matches the confirmed `status: "success" | "failed"` contract exactly —
// an empty body, unparseable JSON, or any other `status` value is treated as
// a failure rather than optimistically assumed to have succeeded, since a
// wrongly-assumed success would mark a code redeemed (and the order running)
// without the player ever actually receiving it.
function parseRedeemResponse(text: string): RedeemResult {
  if (!text) return { success: false, error: "UniPin থেকে খালি response এসেছে" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "UniPin response পার্স করা যায়নি" };
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (obj.status === "success") return { success: true };
    if (obj.status === "failed") {
      const content = typeof obj.content === "string" && obj.content ? obj.content : "UniPin ব্যর্থতা রিপোর্ট করেছে";
      return { success: false, error: content };
    }
  }

  return { success: false, error: "UniPin থেকে অপ্রত্যাশিত response এসেছে" };
}
