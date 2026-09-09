import { logApiCall } from "@/lib/api-log";

type FFLikesResult =
  | { success: true; nickname: string | null; likesGiven: number | null; remainingToday: number | null }
  | { success: false; error: string };

export const FFLIKES_DEFAULT_BASE_URL = "https://fflikes.ucbot.net";
export const FFLIKES_DEFAULT_SERVER = "BD";

// The docs are strict about this and the API rejects anything else with a 400,
// which still burns a request — so check before spending one.
const UID_PATTERN = /^\d{7,15}$/;

export function isValidFFLikesUid(uid: string): boolean {
  return UID_PATTERN.test(uid.trim());
}

/**
 * Picks the endpoint for one denom entry. The recipe drives the package size the
 * same way it does for UniPin/Shell: "200" buys the 200-like call, anything else
 * (including a blank recipe) buys the standard 100-like one. A "100,100" recipe
 * is therefore two /like calls — see fflikes-fulfillment.
 */
export function fflikesPathForDenom(denom: string | null): "/like200" | "/like" {
  return denom?.trim() === "200" ? "/like200" : "/like";
}

/**
 * Sends one FF Likes request for an order.
 *
 * Documented contract (https://ucbot.net/ff-likes-api-docs): GET with every
 * parameter in the query string, `api_key` for auth, `uid` the target player.
 * A 200 with `success: true` is NOT enough to call it delivered — the vendor
 * also reports `data.status`, where 1 means likes were actually sent and 2 means
 * none were (and is not even billed). Only status 1 counts as success here, so
 * an order is never marked delivered for likes the player never received.
 */
export async function callFFLikesApi(params: {
  apiSettingId: number;
  baseUrl: string | null;
  apiKey: string | null;
  serverName: string | null;
  denom: string | null;
  playerId: string;
  orderId: string;
}): Promise<FFLikesResult> {
  if (!params.apiKey) return { success: false, error: "FF Likes API key সেট করা নেই" };

  const uid = params.playerId.trim();
  if (!isValidFFLikesUid(uid)) {
    return { success: false, error: `Player UID "${uid}" সঠিক নয় — ৭ থেকে ১৫ ডিজিট হতে হবে` };
  }

  const base = (params.baseUrl?.trim() || FFLIKES_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = new URL(base + fflikesPathForDenom(params.denom));
  url.searchParams.set("api_key", params.apiKey);
  url.searchParams.set("uid", uid);
  url.searchParams.set("server_name", params.serverName?.trim() || FFLIKES_DEFAULT_SERVER);

  // The key travels in the query string (the API offers no header auth), so keep
  // it out of the stored log — these rows are readable from the admin panel.
  const loggedUrl = new URL(url);
  loggedUrl.searchParams.set("api_key", "***");
  const requestBody = `GET ${loggedUrl.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    await logApiCall({
      orderId: params.orderId,
      apiSettingId: params.apiSettingId,
      deliveryMethod: "FFLIKES",
      denom: params.denom ?? undefined,
      requestBody,
      errorMessage: message,
      success: false,
    });
    return { success: false, error: message };
  }

  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const data = (parsed?.data ?? null) as Record<string, unknown> | null;
  const likeStatus = typeof data?.status === "number" ? data.status : null;
  const ok = response.status === 200 && parsed?.success === true && likeStatus === 1;

  const error = !ok
    ? describeFailure(response.status, parsed, likeStatus)
    : undefined;

  await logApiCall({
    orderId: params.orderId,
    apiSettingId: params.apiSettingId,
    deliveryMethod: "FFLIKES",
    denom: params.denom ?? undefined,
    requestBody,
    responseBody: text,
    statusCode: response.status,
    errorMessage: error,
    success: ok,
  });

  if (!ok) return { success: false, error: error ?? `HTTP ${response.status}` };

  return {
    success: true,
    nickname: typeof data?.PlayerNickname === "string" ? data.PlayerNickname : null,
    likesGiven: typeof data?.LikesGivenByAPI === "number" ? data.LikesGivenByAPI : null,
    remainingToday: typeof data?.remaining_today === "number" ? data.remaining_today : null,
  };
}

// Turns the documented error codes into something an admin can act on, rather
// than a bare status number in the order note.
function describeFailure(
  statusCode: number,
  parsed: Record<string, unknown> | null,
  likeStatus: number | null
): string {
  const vendorError = typeof parsed?.error === "string" ? parsed.error : null;

  if (statusCode === 200 && likeStatus === 2) {
    return "কোনো লাইক দেওয়া যায়নি (status 2) — সাধারণত এই UID আজ ইতিমধ্যে লাইক পেয়েছে";
  }

  const byCode: Record<number, string> = {
    400: "প্যারামিটার ভুল (সাধারণত UID ভুল)",
    401: "API key পাঠানো হয়নি",
    403: "API key অচল/বন্ধ, অথবা এই UID আজকের জন্য ব্লক",
    429: "আজকের লিমিট শেষ",
    503: "ভেন্ডরের কোনো অ্যাকাউন্ট গ্রুপ ফাঁকা নেই",
    500: "ভেন্ডরের সার্ভারে সমস্যা",
  };

  const known = byCode[statusCode];
  if (known) return vendorError ? `${known} (${vendorError})` : known;
  return vendorError ?? `HTTP ${statusCode}`;
}
