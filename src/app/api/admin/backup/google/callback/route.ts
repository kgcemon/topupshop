import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBackupSetting } from "@/lib/backup";
import { backupSettingsUrl, getDriveRedirectUri } from "@/lib/backup-redirect";
import { exchangeCodeForTokens, fetchConnectedEmail, resolveOAuthCredentials } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const fail = async (message: string) =>
    NextResponse.redirect(await backupSettingsUrl({ error: message }));

  const deniedReason = params.get("error");
  if (deniedReason) {
    await prisma.backupSetting.update({ where: { id: 1 }, data: { oauthState: null } });
    return fail(`Google অনুমতি দেয়নি: ${deniedReason}`);
  }

  const setting = await getBackupSetting();
  const state = params.get("state");
  // The stored state is cleared here whatever happens next, so a leaked
  // callback URL can't be replayed.
  await prisma.backupSetting.update({ where: { id: 1 }, data: { oauthState: null } });
  if (!state || !setting.oauthState || state !== setting.oauthState) {
    return fail("অনুরোধটি মেয়াদোত্তীর্ণ — আবার Connect চাপুন।");
  }

  const code = params.get("code");
  if (!code) return fail("Google কোনো authorization code পাঠায়নি।");

  const credentials = resolveOAuthCredentials(setting);
  if (!credentials) return fail("Google Client ID এবং Secret সেভ করা নেই।");

  try {
    const tokens = await exchangeCodeForTokens({
      ...credentials,
      code,
      redirectUri: await getDriveRedirectUri(),
    });

    // Without a refresh token the backups would stop working an hour later,
    // so treat that as a failed connection rather than a silent half-setup.
    if (!tokens.refresh_token) {
      return fail(
        "Google refresh token দেয়নি। Google Account → Security → Third-party access থেকে অ্যাপটি সরিয়ে আবার Connect করুন।"
      );
    }

    const email = await fetchConnectedEmail(tokens.access_token);

    await prisma.backupSetting.update({
      where: { id: 1 },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleAccessToken: tokens.access_token,
        googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        googleEmail: email,
        // A reconnect may point at a different account, so the old folder id
        // belongs to a Drive we can no longer write to.
        driveFolderId: null,
        lastError: null,
      },
    });

    return NextResponse.redirect(await backupSettingsUrl({ connected: "1" }));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Google সংযোগ ব্যর্থ হয়েছে।");
  }
}
