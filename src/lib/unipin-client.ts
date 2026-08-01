import { logApiCall } from "@/lib/api-log";

type RedeemResult = { success: true } | { success: false; error: string };

// Submits an already-owned UniPin code (claimed from local stock — see
// unipin-fulfillment.ts) to be applied to a player's account. This never
// purchases/generates a new code; it only redeems one we already hold.
// The header-based auth and the exact "did it succeed" check on the JSON
// body are a best-effort guess pending the real Unipin API spec — verify
// against ApiCallLog / your test endpoint and adjust here once confirmed.
export async function redeemUnipinCode(params: {
  apiSettingId: number;
  endpoint: string;
  apiKey: string | null;
  apiSecret: string | null;
  denom: string;
  code: string;
  playerId: string;
  orderId: string;
}): Promise<RedeemResult> {
  const body = { playerid: params.playerId, denom: params.denom, unipincode: params.code };
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

// A 2xx HTTP status is treated as success unless the body explicitly says
// otherwise (an explicit `success: false`, or a `status` field that reads
// like a failure) — the real UniPin redeem API's exact success/failure
// contract is unconfirmed, so this errs toward trusting the HTTP status.
function parseRedeemResponse(text: string): RedeemResult {
  if (!text) return { success: true };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: true };
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (obj.success === false) {
      return { success: false, error: firstString(obj.error, obj.message) ?? "API reported failure" };
    }
    if (typeof obj.status === "string" && /fail|error/i.test(obj.status)) {
      return { success: false, error: firstString(obj.message, obj.status) ?? obj.status };
    }
  }

  return { success: true };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}
