// Minimal Google Drive v3 client built on fetch.
//
// `googleapis` pulls in ~50MB of generated clients for the three calls this
// feature makes (create folder, upload file, delete file), so the REST API is
// called directly instead.

// `drive.file` is the narrowest scope that can upload: it grants access only to
// files this app itself created, so connecting a Drive here can never expose
// the rest of the account's documents. `openid email` is only used to show
// which account is connected in the admin UI.
export const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file openid email";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export type OAuthCredentials = { clientId: string; clientSecret: string };

/**
 * OAuth client for the Drive connection. Admin-entered values win so a Drive
 * can be connected without touching env; otherwise a dedicated
 * GOOGLE_DRIVE_CLIENT_ID/SECRET pair, and finally the AUTH_GOOGLE_* client the
 * site already uses for Google login (same Cloud project, one more redirect URI).
 */
export function resolveOAuthCredentials(setting?: {
  googleClientId?: string | null;
  googleClientSecret?: string | null;
}): OAuthCredentials | null {
  const clientId =
    setting?.googleClientId?.trim() ||
    process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() ||
    process.env.AUTH_GOOGLE_ID?.trim() ||
    "";
  const clientSecret =
    setting?.googleClientSecret?.trim() ||
    process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim() ||
    process.env.AUTH_GOOGLE_SECRET?.trim() ||
    "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function buildConsentUrl({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES,
    // Backups run with nobody at the keyboard, so a refresh token is required —
    // and Google only re-issues one when consent is forced.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google token request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export function exchangeCodeForTokens({
  clientId,
  clientSecret,
  code,
  redirectUri,
}: OAuthCredentials & { code: string; redirectUri: string }) {
  return postToken({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}: OAuthCredentials & { refreshToken: string }) {
  return postToken({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

export async function fetchConnectedEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    // Cosmetic only — a missing address must never fail the connection.
    return null;
  }
}

async function driveJson<T>(response: Response, what: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google Drive ${what} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/**
 * Returns `folderId` if it still exists and isn't trashed. `drive.file` can't
 * search the Drive for a folder by name, so a folder the admin deleted by hand
 * has to be recreated rather than found again.
 */
export async function isFolderUsable(accessToken: string, folderId: string) {
  const response = await fetch(
    `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(folderId)}?fields=id,trashed`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!response.ok) return false;
  const data = (await response.json()) as { trashed?: boolean };
  return !data.trashed;
}

export async function createFolder(accessToken: string, name: string) {
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
    cache: "no-store",
  });
  const data = await driveJson<{ id: string }>(response, "folder create");
  return data.id;
}

/**
 * Resumable upload in two calls (start session, send the bytes). Drive's
 * simple/multipart upload caps out at 5MB, which a grown-up database would
 * quietly exceed.
 */
export async function uploadFile({
  accessToken,
  folderId,
  name,
  mimeType,
  body,
}: {
  accessToken: string;
  folderId: string;
  name: string;
  mimeType: string;
  body: Buffer;
}) {
  const start = await fetch(`${DRIVE_UPLOAD_ENDPOINT}?uploadType=resumable&fields=id,name,size`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(body.byteLength),
    },
    body: JSON.stringify({ name, parents: [folderId] }),
    cache: "no-store",
  });

  if (!start.ok) {
    const text = await start.text();
    throw new Error(`Google Drive upload start failed (${start.status}): ${text.slice(0, 300)}`);
  }

  const sessionUrl = start.headers.get("location");
  if (!sessionUrl) throw new Error("Google Drive upload start returned no session URL");

  const upload = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(body.byteLength),
    },
    body: new Uint8Array(body),
    cache: "no-store",
  });

  return driveJson<{ id: string; name: string; size?: string }>(upload, "upload");
}

/** Resolves even when the file is already gone — retention must stay idempotent. */
export async function deleteFile(accessToken: string, fileId: string) {
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.ok || response.status === 404) return;
  const text = await response.text();
  throw new Error(`Google Drive delete failed (${response.status}): ${text.slice(0, 200)}`);
}
