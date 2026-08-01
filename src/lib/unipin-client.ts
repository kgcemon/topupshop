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
      denom: params.denom,
      requestBody,
      responseBody: message,
      success: false,
    });
    return { success: false, error: message };
  }

  const text = await response.text();
  await logApiCall({
    orderId: params.orderId,
    apiSettingId: params.apiSettingId,
    denom: params.denom,
    requestBody,
    responseBody: text,
    statusCode: response.status,
    success: response.ok,
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "Response was not valid JSON" };
  }

  const code = extractCode(parsed);
  if (!code) {
    return { success: false, error: "No code/pin/voucher field found in response" };
  }

  return { success: true, code };
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
