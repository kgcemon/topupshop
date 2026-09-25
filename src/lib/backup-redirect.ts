import { headers } from "next/headers";

export const DRIVE_CALLBACK_PATH = "/api/admin/backup/google/callback";
export const BACKUP_ADMIN_PATH = "/admin/backups";

/**
 * The origin the admin is actually browsing, taken from the request rather
 * than NEXT_PUBLIC_SITE_URL so the OAuth round trip also works on localhost
 * and on a staging hostname.
 */
export async function getRequestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * The exact redirect URI handed to Google — it has to match an "Authorized
 * redirect URI" on the OAuth client character for character, so /admin/backups
 * shows this same value for copying into the Google Cloud Console.
 */
export async function getDriveRedirectUri() {
  return `${await getRequestOrigin()}${DRIVE_CALLBACK_PATH}`;
}

export async function backupSettingsUrl(params?: Record<string, string>) {
  const url = new URL(BACKUP_ADMIN_PATH, await getRequestOrigin());
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  return url;
}
