import { logApiCall } from "@/lib/api-log";

type ShellCallResult =
  | { success: true; reference: string }
  | { success: false; error: string };

// Field names and auth shape are a best-effort guess (mirrors the same
// unverified-pending-real-docs posture as unipin-client.ts) — no confirmed
// Shell API spec exists yet. Verify against ApiCallLog / your test endpoint
// and adjust here once the real contract is known.
export async function callShellApi(params: {
  apiSettingId: number;
  endpoint: string;
  userId: string | null;
  password: string | null;
  code: string | null;
  playerId: string;
  orderId: string;
  amount: number;
}): Promise<ShellCallResult> {
  const body = {
    userId: params.userId,
    password: params.password,
    code: params.code,
    uid: params.playerId,
    amount: params.amount,
  };
  const requestBody = JSON.stringify(body);

  let response: Response;
  try {
    response = await fetch(params.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    await logApiCall({
      orderId: params.orderId,
      apiSettingId: params.apiSettingId,
      deliveryMethod: "SHELL",
      requestBody,
      errorMessage: message,
      success: false,
    });
    return { success: false, error: message };
  }

  const text = await response.text();

  const result: ShellCallResult = !response.ok
    ? { success: false, error: `HTTP ${response.status}` }
    : parseShellResponse(text);

  await logApiCall({
    orderId: params.orderId,
    apiSettingId: params.apiSettingId,
    deliveryMethod: "SHELL",
    requestBody,
    responseBody: text,
    statusCode: response.status,
    errorMessage: result.success ? undefined : result.error,
    success: result.success,
  });

  return result;
}

function extractReference(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["reference", "code", "trxId", "transactionId", "id"]) {
    const value = obj[key];
    if (typeof value === "string" && value) return value;
  }
  if (obj.data && typeof obj.data === "object") return extractReference(obj.data);
  return null;
}

function parseShellResponse(text: string): ShellCallResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "Response was not valid JSON" };
  }
  const reference = extractReference(parsed);
  return reference
    ? { success: true, reference }
    : { success: false, error: "No reference/code field found in response" };
}
