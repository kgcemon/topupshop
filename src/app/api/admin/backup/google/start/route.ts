import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBackupSetting } from "@/lib/backup";
import { backupSettingsUrl, getDriveRedirectUri } from "@/lib/backup-redirect";
import { buildConsentUrl, resolveOAuthCredentials } from "@/lib/google-drive";

// Starts the Google Drive consent flow. /api/* isn't covered by the proxy
// matcher, so the admin check has to happen here too.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const setting = await getBackupSetting();
  const credentials = resolveOAuthCredentials(setting);
  if (!credentials) {
    return NextResponse.redirect(
      await backupSettingsUrl({ error: "Google Client ID এবং Secret আগে সেভ করুন।" })
    );
  }

  // Single-use CSRF token; the callback refuses anything that doesn't match.
  const state = randomUUID();
  await prisma.backupSetting.update({ where: { id: 1 }, data: { oauthState: state } });

  const redirectUri = await getDriveRedirectUri();
  return NextResponse.redirect(
    buildConsentUrl({ clientId: credentials.clientId, redirectUri, state })
  );
}
