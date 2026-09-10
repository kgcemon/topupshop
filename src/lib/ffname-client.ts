export const FFNAME_DEFAULT_BASE_URL = "https://ffapi.ucbot.net";

// The vendor rejects anything else, and a bad uid still costs a request.
const UID_PATTERN = /^\d{6,15}$/;

export type FFNameResult =
  | { ok: true; nickname: string; level: number | null; likes: number | null; region: string | null }
  | { ok: false; error: string };

export function isValidFFNameUid(uid: string): boolean {
  return UID_PATTERN.test(uid.trim());
}

/**
 * Looks up a Free Fire player's in-game name for a uid.
 *
 * Contract, confirmed against the live endpoint:
 *   GET {base}/nickname?uid=... with the key in an Authorization header,
 *   answering { status, success, player_info: { nickname, level, likes, region } }.
 *
 * A failed lookup still comes back HTTP 200 — an unknown uid answers
 * { status: "error", error: "Backend error 500" } with the same 200 — so the
 * body's own status is what decides, never the HTTP code.
 */
export async function lookupFFName(params: {
  baseUrl: string | null;
  apiKey: string | null;
  uid: string;
}): Promise<FFNameResult> {
  if (!params.apiKey) return { ok: false, error: "নেম চেক সার্ভিস কনফিগার করা নেই" };

  const uid = params.uid.trim();
  if (!isValidFFNameUid(uid)) return { ok: false, error: "আইডি সঠিক নয়" };

  const base = (params.baseUrl?.trim() || FFNAME_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const url = `${base}/nickname?uid=${encodeURIComponent(uid)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: params.apiKey },
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { ok: false, error: "নাম আনা গেল না, আবার চেষ্টা করুন" };
  }

  // A rejected key answers 401 (unlike an unknown uid, which answers 200 with an
  // error body). Keeping them apart matters: otherwise a misconfigured key looks
  // to everyone like every player id in the country has stopped existing.
  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: "নেম চেক API key ঠিক নেই — অ্যাডমিন সেটিংস দেখুন" };
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "নাম আনা গেল না, আবার চেষ্টা করুন" };
  }

  const info = (body.player_info ?? null) as Record<string, unknown> | null;
  const nickname = typeof info?.nickname === "string" ? info.nickname.trim() : "";

  if (body.status !== "success" || !nickname) {
    // The vendor's own message ("Backend error 500") means nothing to a buyer;
    // what they need to know is that this id didn't resolve.
    return { ok: false, error: "এই আইডিতে কোনো প্লেয়ার পাওয়া যায়নি" };
  }

  return {
    ok: true,
    nickname,
    level: typeof info?.level === "number" ? info.level : null,
    likes: typeof info?.likes === "number" ? info.likes : null,
    region: typeof info?.region === "string" ? info.region : null,
  };
}
