import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTaka, generateReferralCode, formatDhakaDate } from "@/lib/utils";
import { getUserOrderStats, getLeaderboard, getUserReferralStats, getSiteSettings } from "@/lib/data";
import { getLevelProgress } from "@/lib/levels";
import { LevelBadge } from "@/components/level-badge";
import { LogoutButton } from "@/components/logout-button";
import { CopyButton } from "@/components/copy-button";
import { ProfileEditForm } from "@/components/profile-edit-form";

const NAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [initialUser, orderStats, leaderboard, referralStats, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getUserOrderStats(userId),
    getLeaderboard(userId, 1),
    getUserReferralStats(userId),
    getSiteSettings(),
  ]);

  let user = initialUser;

  if (user && !user.referralCode) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: generateReferralCode() },
    });
  }

  const referralLink = `${siteUrl}/register?ref=${user?.referralCode ?? ""}`;

  const { current, next, ordersToNext, progressPercent } = getLevelProgress(orderStats.completedOrders);
  const memberSince = user?.createdAt
    ? formatDhakaDate(user.createdAt, { year: "numeric", month: "long", day: "numeric" })
    : null;

  const nameLockedUntil = user?.nameChangedAt
    ? new Date(user.nameChangedAt.getTime() + NAME_CHANGE_COOLDOWN_MS)
    : null;
  const nameLockedUntilLabel =
    nameLockedUntil && nameLockedUntil > new Date()
      ? formatDhakaDate(nameLockedUntil, { year: "numeric", month: "long", day: "numeric" })
      : null;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-4 pb-16 pt-6 text-white sm:px-6 sm:pt-8">
          <p className="text-sm opacity-90">আমার প্রোফাইল</p>
        </div>

        <div className="-mt-12 px-4 pb-6 sm:px-6 sm:-mt-10">
          <ProfileEditForm
            name={user?.name ?? null}
            phone={user?.phone ?? null}
            image={user?.image ?? null}
            nameLockedUntilLabel={nameLockedUntilLabel}
            levelBadge={<LevelBadge completedOrders={orderStats.completedOrders} />}
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoRow label="ইমেইল" value={user?.email ?? "-"} />
            <InfoRow label="সদস্য হয়েছেন" value={memberSince ?? "-"} />
            <InfoRow
              label="র‍্যাংক"
              value={leaderboard.currentUserEntry.rank ? `#${leaderboard.currentUserEntry.rank}` : "Unranked"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">Wallet Balance</p>
          {settings.depositEnabled && (
            <Link href="/dashboard/deposit" className="text-sm font-semibold text-primary-600">
              টাকা যোগ করুন &rarr;
            </Link>
          )}
        </div>
        <p className="text-2xl font-bold text-primary-600">{formatTaka(user?.walletBalance ?? 0)} টাকা</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="mb-1 text-base font-bold">বন্ধুকে রেফার করুন</h2>
        <p className="mb-4 text-xs text-gray-500">
          আপনার লিংক দিয়ে কেউ জয়েন করে প্রথম অর্ডার করলে এবং সেটি ডেলিভার হলে, সেই অর্ডারের{" "}
          <span className="font-semibold">{settings.referralBonusPercent}%</span> টাকা আপনি এবং সে —
          দুজনেই ওয়ালেটে বোনাস হিসেবে পাবেন।
        </p>

        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase">আপনার রেফারেল কোড</p>
            <p className="truncate font-mono text-sm font-bold text-gray-900">{user?.referralCode}</p>
          </div>
          <CopyButton value={user?.referralCode ?? ""} label="Copy Code" />
        </div>

        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase">শেয়ার লিংক</p>
            <p className="truncate text-xs text-gray-600">{referralLink}</p>
          </div>
          <CopyButton value={referralLink} label="Copy Link" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="মোট রেফার" value={String(referralStats.referredCount)} />
          <InfoRow label="মোট বোনাস আয়" value={`${formatTaka(referralStats.totalEarned)} টাকা`} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">লেভেল প্রোগ্রেস</h2>
          <Link href="/dashboard/leaderboard" className="text-sm font-semibold text-primary-600">
            লিডারবোর্ড &rarr;
          </Link>
        </div>
        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="text-xs text-gray-500">
          {next
            ? `${current.labelBn} থেকে ${next.labelBn} লেভেলে যেতে আর ${ordersToNext} টি সফল অর্ডার লাগবে`
            : "আপনি সর্বোচ্চ লেভেলে পৌঁছে গেছেন!"}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          মোট সফল অর্ডার: <span className="font-semibold">{orderStats.completedOrders}</span> · মোট খরচ:{" "}
          <span className="font-semibold">{formatTaka(orderStats.totalSpent)} টাকা</span>
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-800">লগ আউট</p>
            <p className="text-xs text-gray-500">এই ডিভাইস থেকে সাইন আউট করুন</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="truncate text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
