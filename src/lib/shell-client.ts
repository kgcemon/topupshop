import { logApiCall } from "@/lib/api-log";

type ShellCallResult = { success: true } | { success: false; error: string };

// Same reseller/bot as unipin-client.ts's UNIPIN_TG_BOT_ID — this vendor
// serves both UniPin and Shell top-ups through the same backend, hence the
// near-identical request shape (playerid/pacakge/orderid/url/tgbotid/ourstock).
const SHELL_TG_BOT_ID = "701657976";

// Confirmed request contract:
//   { playerid, pacakge, code: "shell", orderid, url, username, password,
//     autocode, tgbotid, shell_balance, ourstock }
// `code` is always the literal string "shell" here — it's how this shared
// endpoint tells a Shell top-up apart from a UniPin voucher redeem (where
// `code` instead carries the actual voucher code). `username`/`password` are
// this Shell reseller account's login, `autocode` is the account's shell
// top-up code — both come from the SHELL ApiSetting row (apiKey/apiSecret/
// code respectively), not from the separate manual GarenaShellAccount vault.
export async function callShellApi(params: {
  apiSettingId: number;
  endpoint: string;
  username: string | null;
  password: string | null;
  autocode: string | null;
  denom: string | null;
  playerId: string;
  orderId: string;
  orderSerial: number;
  callbackUrl: string;
  shellBalance: number;
}): Promise<ShellCallResult> {
  const body = {
    playerid: params.playerId,
    pacakge: params.denom ?? "",
    code: "shell",
    orderid: params.orderSerial,
    url: params.callbackUrl,
    username: params.username,
    password: params.password,
    autocode: params.autocode,
    tgbotid: SHELL_TG_BOT_ID,
    shell_balance: params.shellBalance,
    ourstock: 1,
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

  // Same posture as unipin-client.ts's redeem call: only the HTTP status
  // decides success/failure here, the body is logged but not parsed. Real
  // confirmation comes via the `url` callback (see
  // src/app/api/shell/callback/route.ts).
  const result: ShellCallResult =
    response.status === 200 ? { success: true } : { success: false, error: `HTTP ${response.status}` };

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
