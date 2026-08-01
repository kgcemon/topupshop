import { logApiCall } from "@/lib/api-log";

type PurchaseResult =
  | { success: true; code: string }
  | { success: false; error: string };

// Field names (`uid`, `package`) and the header-based auth are a best-effort
// guess pending the real Unipin API spec — verify against ApiCallLog / your
// test endpoint and adjust here once confirmed.
export async function purchaseUnipinCode(params: {
  apiSettingId: number;
  endpoint: string;
  apiKey: string | null;
  apiSecret: string | null;
  denom: string;
  playerId: string;
  orderId: string;
}): Promise<PurchaseResult> {
  const body = { uid: params.playerId, package: params.denom };
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

  // Determine the true final outcome (including "response was OK but had no
  // usable code") before logging, so `success`/`errorMessage` always reflect
  // what actually happened rather than just the HTTP status.
  const result: PurchaseResult = !response.ok
    ? { success: false, error: `HTTP ${response.status}` }
    : parseUnipinResponse(text);

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

function extractCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["code", "pin", "voucher", "serial"]) {
    const value = obj[key];
    if (typeof value === "string" && value) return value;
  }
  if (obj.data && typeof obj.data === "object") return extractCode(obj.data);
  return null;
}

function parseUnipinResponse(text: string): PurchaseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "Response was not valid JSON" };
  }
  const code = extractCode(parsed);
  return code ? { success: true, code } : { success: false, error: "No code/pin/voucher field found in response" };
}
