import { prisma } from "@/lib/prisma";
import { ORDER_COUNT_STATUSES } from "@/lib/levels";

export async function getSiteSettings() {
  const settings = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  return (
    settings ?? {
      id: 1,
      siteName: "Uc Ghor",
      tagline: "Largest TopUp Site In Bangladesh",
      metaTitle: null,
      metaDescription: null,
      metaKeywords: null,
      ogImage: null,
      favicon: null,
      referralBonusPercent: 1.5,
      whatsappNumber: "01343053411",
      telegramLink: "https://t.me/",
      facebookLink: null,
      contactEmail: "support@ucghor.com",
      bkashNumber: "01343053411",
      nagadNumber: "01343053411",
      rocketNumber: "01343053411",
      bkashIcon: null,
      nagadIcon: null,
      rocketIcon: null,
      walletIcon: null,
      allowGuestOrders: false,
    }
  );
}

export async function getActiveBanners() {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getActiveNotice() {
  return prisma.notice.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getHomeProducts() {
  const sections = await prisma.section.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { rechargeOptions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return sections.filter((section) => section.products.length > 0);
}

export async function getAllSections() {
  return prisma.section.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getProductById(id: number) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      rechargeOptions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getUserOrderStats(userId: string) {
  const result = await prisma.order.aggregate({
    where: { userId, status: { in: [...ORDER_COUNT_STATUSES] } },
    _count: { id: true },
    _sum: { amount: true },
  });

  return {
    completedOrders: result._count.id,
    totalSpent: result._sum.amount ?? 0,
  };
}

export async function getDeliveredOrderStats(userId: string) {
  const result = await prisma.order.aggregate({
    where: { userId, status: "DELIVERED" },
    _count: { id: true },
    _sum: { amount: true },
  });

  return {
    deliveredOrders: result._count.id,
    deliveredAmount: result._sum.amount ?? 0,
  };
}

export async function getLeaderboard(currentUserId: string, limit = 50) {
  const grouped = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: { in: [...ORDER_COUNT_STATUSES] } },
    _count: { id: true },
    _sum: { amount: true },
    orderBy: [{ _count: { id: "desc" } }, { _sum: { amount: "desc" } }],
  });

  // Guest orders (userId null) have no account to rank on the leaderboard.
  const ranked = grouped
    .filter((g): g is typeof g & { userId: string } => g.userId !== null)
    .map((g) => ({
      userId: g.userId,
      completedOrders: g._count.id,
      totalSpent: g._sum.amount ?? 0,
    }));

  const topEntries = ranked.slice(0, limit);
  const userIds = topEntries.map((r) => r.userId);
  const currentUserIndex = ranked.findIndex((r) => r.userId === currentUserId);
  const isCurrentUserInTop = currentUserIndex !== -1 && currentUserIndex < limit;

  if (!isCurrentUserInTop && currentUserIndex !== -1) {
    userIds.push(currentUserId);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  const top = topEntries.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    name: userNameById.get(entry.userId) ?? "User",
    completedOrders: entry.completedOrders,
    totalSpent: entry.totalSpent,
    isCurrentUser: entry.userId === currentUserId,
  }));

  const currentUserEntry =
    currentUserIndex === -1
      ? { rank: null, completedOrders: 0, totalSpent: 0 }
      : {
          rank: currentUserIndex + 1,
          completedOrders: ranked[currentUserIndex].completedOrders,
          totalSpent: ranked[currentUserIndex].totalSpent,
        };

  return { top, currentUserEntry, totalRankedCustomers: ranked.length };
}

export async function getAllActiveProductsForSitemap() {
  return prisma.product.findMany({
    where: { isActive: true, type: "NORMAL" },
    select: { id: true, slug: true, updatedAt: true },
  });
}

export async function getPublishedBlogPosts(limit = 60) {
  return prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { _count: { select: { likes: true, comments: true } } },
  });
}

export async function getBlogPostBySlug(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, isPublished: true },
    include: {
      _count: { select: { likes: true, comments: true } },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true, image: true } },
          _count: { select: { likes: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            take: 20,
            include: {
              user: { select: { id: true, name: true, image: true } },
              _count: { select: { likes: true } },
            },
          },
        },
      },
    },
  });
}

export async function getUserNotifications(userId: string, limit = 5) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true, image: true } } },
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function isBlogPostLikedByUser(postId: number, userId: string) {
  const like = await prisma.blogLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  return !!like;
}

export async function getLikedBlogCommentIds(postId: number, userId: string) {
  const likes = await prisma.blogCommentLike.findMany({
    where: { userId, comment: { postId } },
    select: { commentId: true },
  });
  return new Set(likes.map((l) => l.commentId));
}

export async function getUserReferralStats(userId: string) {
  const [referredCount, earnedResult] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.walletTransaction.aggregate({
      where: { userId, type: "REFERRAL_BONUS" },
      _sum: { amount: true },
    }),
  ]);

  return {
    referredCount,
    totalEarned: earnedResult._sum.amount ?? 0,
  };
}

export async function getAllPublishedBlogPostsForSitemap() {
  return prisma.blogPost.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
  });
}
