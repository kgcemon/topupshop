import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const getSessionWithWallet = cache(async () => {
  const session = await auth();
  if (!session?.user) return { session, walletBalance: 0 };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalance: true },
  });

  return { session, walletBalance: user?.walletBalance ?? 0 };
});
