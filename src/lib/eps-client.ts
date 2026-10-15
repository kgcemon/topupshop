import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Thin client for the EPS (Easy Payment System) merchant API — the three calls
// from the "EPS Merchant API Integration Guide V5": GetToken, InitializeEPS and
// CheckMerchantTransactionStatus. Everything about *what* a payment pays for
// lives in eps-payments.ts; this file only talks to EPS.

export const DEFAULT_EPS_API_BASE_URL = "https://pgapi.eps.com.bd/v1";

const REQUEST_TIMEOUT_MS = 25_000;

// Refresh the bearer this long before EPS says it expires, so a token never
// runs out between being read here and EPS checking it.
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
// Used when neither the JWT nor expireDate gives a usable expiry.
const FALLBACK_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

export class EpsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "EpsError";
  }
}

export type EpsCredentials = {
  apiBaseUrl: string;
  userName: string;
  password: string;
  hashKey: string;
  merchantId: string;
  storeId: string;
};

export async function getPaymentGatewaySetting() {
  const existing = await prisma.paymentGatewaySetting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  // upsert: the reconciler's first tick and a first page load can race on a fresh install.
  return prisma.paymentGatewaySetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** The credentials, or null while any of them is still missing. */
export function credentialsFrom(setting: Awaited<ReturnType<typeof getPaymentGatewaySetting>>): EpsCredentials | null {
  const { epsUserName, epsPassword, epsHashKey, epsMerchantId, epsStoreId } = setting;
  if (!epsUserName || !epsPassword || !epsHashKey || !epsMerchantId || !epsStoreId) return null;
  return {
    apiBaseUrl: (setting.epsApiBaseUrl || DEFAULT_EPS_API_BASE_URL).replace(/\/+$/, ""),
    userName: epsUserName,
    password: epsPassword,
    hashKey: epsHashKey,
    merchantId: epsMerchantId,
    storeId: epsStoreId,
  };
}

/** Guide, "Mechanism for Hash": HMAC-SHA512 keyed with the UTF-8 hash key, Base64 out. */
export function epsHash(hashKey: string, value: string) {
  return createHmac("sha512", Buffer.from(hashKey, "utf8")).update(value, "utf8").digest("base64");
}

// EPS answers GetToken in camelCase and the EPSEngine calls in PascalCase;
// read every field case-insensitively so either shape (or a future change) works.
function field(obj: Record<string, unknown>, name: string): unknown {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === wanted) return obj[key];
  }
  return undefined;
}

function str(obj: Record<string, unknown>, name: string): string {
  const v = field(obj, name);
  return v == null ? "" : String(v).trim();
}

type EpsResponse = {
  status: number;
  text: string;
  json: Record<string, unknown> | null;
  /** Where EPS tried to send us on a 3xx (or where a followed redirect ended up). */
  location: string;
};

async function callEps(
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: unknown }
): Promise<EpsResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
      // EPS answers an expired/revoked bearer with a 302 to its
      // /Identity/Account/Login page instead of a 401. Following it lands on a
      // 404 that looks like an outage, so keep the 3xx and judge it ourselves.
      redirect: "manual",
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError" ? "সময়সীমা পেরিয়ে গেছে" : String(error);
    throw new EpsError(`EPS সার্ভারে সংযোগ করা যায়নি (${reason})`);
  }

  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") json = parsed as Record<string, unknown>;
  } catch {
    // Non-JSON (an HTML error page, say) — callers report the status instead.
  }
  const location = response.headers.get("location") || (response.redirected ? response.url : "");
  return { status: response.status, text, json, location };
}

// ---------- Token (API 01) ----------

const globalForEps = globalThis as unknown as {
  epsToken?: { token: string; expiresAt: number; key: string };
  epsTokenInflight?: Promise<string>;
};

/** Expiry from the JWT's own `exp` claim — unambiguous, unlike expireDate which carries no time zone. */
function jwtExpiry(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function resolveExpiry(token: string, expireDate: string): number {
  const now = Date.now();
  const fromJwt = jwtExpiry(token);
  if (fromJwt && fromJwt > now) return fromJwt;
  // No zone on expireDate: read it as UTC, the earlier of the two readings for
  // Dhaka (UTC+6), so we refresh early rather than late.
  if (expireDate) {
    const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(expireDate) ? expireDate : `${expireDate}Z`);
    if (Number.isFinite(parsed) && parsed > now) return parsed;
  }
  return now + FALLBACK_TOKEN_LIFETIME_MS;
}

// Identifies which credentials a cached token belongs to, so changing them in
// the admin never keeps using a token minted for the old account.
function credentialKey(c: EpsCredentials) {
  return `${c.apiBaseUrl}|${c.userName}|${c.merchantId}`;
}

async function fetchNewToken(c: EpsCredentials): Promise<string> {
  const { status, text, json } = await callEps(`${c.apiBaseUrl}/Auth/GetToken`, {
    method: "POST",
    headers: { "x-hash": epsHash(c.hashKey, c.userName) },
    body: { userName: c.userName, password: c.password },
  });

  const token = json ? str(json, "token") : "";
  if (!token) {
    const message = (json && (str(json, "errorMessage") || str(json, "message"))) || `HTTP ${status}`;
    throw new EpsError(`EPS টোকেন পাওয়া যায়নি: ${message}`, status, text.slice(0, 2000));
  }

  const expiresAt = resolveExpiry(token, json ? str(json, "expireDate") : "");
  globalForEps.epsToken = { token, expiresAt, key: credentialKey(c) };
  // Shared across restarts/instances through the DB; a failed write only costs
  // one extra GetToken later.
  await prisma.paymentGatewaySetting
    .update({ where: { id: 1 }, data: { epsToken: token, epsTokenExpiry: new Date(expiresAt) } })
    .catch(() => undefined);
  return token;
}

/**
 * A bearer token that is valid for at least the next few minutes. Served from
 * memory, then from the DB, and only then minted fresh — with concurrent
 * callers sharing one in-flight GetToken. `force` skips the caches (used after
 * EPS rejects a token with 401, e.g. when EPS revoked it early).
 */
export async function getEpsToken(c: EpsCredentials, opts: { force?: boolean } = {}): Promise<string> {
  const key = credentialKey(c);
  const freshEnough = (expiresAt: number) => expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now();

  if (!opts.force) {
    const mem = globalForEps.epsToken;
    if (mem && mem.key === key && freshEnough(mem.expiresAt)) return mem.token;

    const setting = await getPaymentGatewaySetting();
    if (setting.epsToken && setting.epsTokenExpiry && freshEnough(setting.epsTokenExpiry.getTime())) {
      // The DB row only ever holds a token for the credentials saved beside it.
      const dbCreds = credentialsFrom(setting);
      if (dbCreds && credentialKey(dbCreds) === key) {
        globalForEps.epsToken = { token: setting.epsToken, expiresAt: setting.epsTokenExpiry.getTime(), key };
        return setting.epsToken;
      }
    }
  }

  if (!globalForEps.epsTokenInflight) {
    globalForEps.epsTokenInflight = fetchNewToken(c).finally(() => {
      globalForEps.epsTokenInflight = undefined;
    });
  }
  return globalForEps.epsTokenInflight;
}

/** Drops every cached token — call after the credentials change. */
export async function clearEpsTokenCache() {
  globalForEps.epsToken = undefined;
  await prisma.paymentGatewaySetting
    .update({ where: { id: 1 }, data: { epsToken: null, epsTokenExpiry: null } })
    .catch(() => undefined);
}

/** Drops one specific token from the caches, leaving a newer one alone. */
async function forgetToken(token: string) {
  if (globalForEps.epsToken?.token === token) globalForEps.epsToken = undefined;
  await prisma.paymentGatewaySetting
    .updateMany({ where: { id: 1, epsToken: token }, data: { epsToken: null, epsTokenExpiry: null } })
    .catch(() => undefined);
}

/**
 * Runs an authorised call, and if EPS says the token is no longer good (401/403,
 * a redirect to its login page, or an expired/invalid-token error body), drops
 * that token, gets a new one and tries exactly once more. This is what keeps an
 * expired token from ever surfacing to the customer as a failed checkout or a
 * broken return page.
 */
async function withToken<T>(
  c: EpsCredentials,
  run: (token: string) => Promise<EpsResponse>,
  parse: (res: EpsResponse) => T
): Promise<T> {
  const first = await getEpsToken(c);
  let res = await run(first);
  if (isTokenRejected(res)) {
    console.warn(`[eps] token rejected (HTTP ${res.status}${res.location ? ` -> ${res.location}` : ""}), fetching a new one`);
    await forgetToken(first);
    // If a concurrent request already replaced the dead token, reuse its
    // replacement instead of minting yet another one.
    const cached = globalForEps.epsToken;
    const second = await getEpsToken(c, { force: !cached || cached.token === first });
    res = await run(second);
    if (isTokenRejected(res)) {
      // Never leave a token EPS refuses in the cache for the next customer.
      await forgetToken(second);
      throw new EpsError(
        `EPS নতুন টোকেনও গ্রহণ করেনি (HTTP ${res.status}${res.location ? `, ${res.location}` : ""})`,
        res.status,
        res.text.slice(0, 2000)
      );
    }
  }
  return parse(res);
}

function isTokenRejected(res: EpsResponse) {
  if (res.status === 401 || res.status === 403) return true;
  // A redirect from a JSON API means "go log in" — EPS's way of saying the
  // bearer is expired or revoked.
  if (res.status >= 300 && res.status < 400) return true;
  if (/\/account\/login/i.test(res.location)) return true;
  return /token.{0,20}(expired|invalid)|unauthori[sz]ed/i.test(res.text) && res.status >= 400;
}

// ---------- Initialize payment (API 02) ----------

export type EpsInitializeInput = {
  merchantTransactionId: string;
  customerOrderId: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipAddress: string;
  customer: { name: string; email: string; phone: string; address?: string; city?: string };
  productName: string;
  productCategory?: string;
  reference?: string;
};

export async function initializeEpsPayment(
  c: EpsCredentials,
  input: EpsInitializeInput
): Promise<{ epsTransactionId: string | null; redirectUrl: string }> {
  const city = input.customer.city || "Dhaka";
  const address = input.customer.address || `${city}, Bangladesh`;
  const body = {
    merchantId: c.merchantId,
    storeId: c.storeId,
    CustomerOrderId: input.customerOrderId,
    merchantTransactionId: input.merchantTransactionId,
    transactionTypeId: 1, // 1 = Web
    financialEntityId: 0,
    transitionStatusId: 0,
    totalAmount: input.amount,
    ipAddress: input.ipAddress,
    version: "1",
    successUrl: input.successUrl,
    failUrl: input.failUrl,
    cancelUrl: input.cancelUrl,
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    CustomerAddress: address,
    CustomerAddress2: "",
    CustomerCity: city,
    CustomerState: city,
    CustomerPostcode: "1000",
    CustomerCountry: "BD",
    CustomerPhone: input.customer.phone,
    ShipmentName: "",
    ShipmentAddress: "",
    ShipmentAddress2: "",
    ShipmentCity: "",
    ShipmentState: "",
    ShipmentPostcode: "",
    ShipmentCountry: "",
    ValueA: input.reference ?? "",
    ValueB: "",
    ValueC: "",
    ValueD: "",
    ShippingMethod: "NO",
    NoOfItem: "1",
    ProductName: input.productName.slice(0, 100),
    ProductProfile: "general",
    ProductCategory: (input.productCategory || "Digital").slice(0, 100),
    ProductList: [
      {
        ProductName: input.productName.slice(0, 100),
        NoOfItem: "1",
        ProductProfile: "general",
        ProductCategory: (input.productCategory || "Digital").slice(0, 100),
        ProductPrice: String(input.amount),
      },
    ],
  };

  return withToken(
    c,
    (token) =>
      callEps(`${c.apiBaseUrl}/EPSEngine/InitializeEPS`, {
        method: "POST",
        headers: { "x-hash": epsHash(c.hashKey, input.merchantTransactionId), Authorization: `Bearer ${token}` },
        body,
      }),
    ({ status, text, json }) => {
      const redirectUrl = json ? str(json, "RedirectURL") : "";
      if (!redirectUrl || !/^https:\/\//i.test(redirectUrl)) {
        const message = (json && (str(json, "ErrorMessage") || str(json, "message"))) || `HTTP ${status}`;
        throw new EpsError(`EPS পেমেন্ট শুরু করা যায়নি: ${message}`, status, text.slice(0, 2000));
      }
      // EPS's sample response carries a stray space inside the URL.
      return { epsTransactionId: (json && str(json, "TransactionId")) || null, redirectUrl: redirectUrl.replace(/\s+/g, "") };
    }
  );
}

// ---------- Verify transaction (API 03) ----------

export type EpsVerifyResult = {
  state: "SUCCESS" | "FAILED" | "CANCELLED" | "PENDING";
  rawStatus: string;
  totalAmount: number | null;
  merchantTransactionId: string;
  epsTransactionId: string | null;
  financialEntity: string | null;
  raw: string;
};

function normalizeStatus(status: string): EpsVerifyResult["state"] {
  const s = status.toLowerCase();
  if (s === "success" || s === "successful" || s === "paid" || s === "completed") return "SUCCESS";
  if (s.startsWith("cancel")) return "CANCELLED";
  if (s.startsWith("fail") || s === "declined" || s === "rejected") return "FAILED";
  return "PENDING";
}

/**
 * Asks EPS what really happened to a payment. This — never the query string
 * on the return URL — is the only thing that may mark a payment paid.
 */
export async function verifyEpsTransaction(c: EpsCredentials, merchantTransactionId: string): Promise<EpsVerifyResult> {
  const url = `${c.apiBaseUrl}/EPSEngine/CheckMerchantTransactionStatus?merchantTransactionId=${encodeURIComponent(merchantTransactionId)}`;
  return withToken(
    c,
    (token) =>
      callEps(url, {
        method: "GET",
        headers: { "x-hash": epsHash(c.hashKey, merchantTransactionId), Authorization: `Bearer ${token}` },
      }),
    ({ status, text, json }) => {
      if (!json || status >= 500) {
        throw new EpsError(`EPS থেকে স্ট্যাটাস পাওয়া যায়নি (HTTP ${status})`, status, text.slice(0, 2000));
      }
      const rawStatus = str(json, "Status");
      const returnedId = str(json, "MerchantTransactionId");
      if (!rawStatus) {
        const message = str(json, "ErrorMessage") || str(json, "message") || `HTTP ${status}`;
        throw new EpsError(`EPS স্ট্যাটাস অস্পষ্ট: ${message}`, status, text.slice(0, 2000));
      }
      // Answer for a different transaction = not an answer for ours.
      if (returnedId && returnedId !== merchantTransactionId) {
        throw new EpsError("EPS অন্য একটি ট্রানজেকশনের তথ্য পাঠিয়েছে", status, text.slice(0, 2000));
      }
      const amount = Number(str(json, "TotalAmount").replace(/,/g, ""));
      return {
        state: normalizeStatus(rawStatus),
        rawStatus,
        totalAmount: Number.isFinite(amount) && str(json, "TotalAmount") !== "" ? amount : null,
        merchantTransactionId,
        epsTransactionId: str(json, "EpsTransactionId") || null,
        financialEntity: str(json, "FinancialEntity") || null,
        raw: text.slice(0, 4000),
      };
    }
  );
}
