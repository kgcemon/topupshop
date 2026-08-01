import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { generateReferralCode } from "@/lib/utils";
import { getClientIp } from "@/lib/rate-limit";
import { recordLoginActivity } from "@/lib/login-log";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 365 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return true;
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isBlocked: true, blockedUntil: true },
      });
      const stillBlocked =
        dbUser?.isBlocked && (!dbUser.blockedUntil || dbUser.blockedUntil > new Date());
      return !stillBlocked;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
      }
      // Keep role/name/image fresh in case they change (e.g. promoted to admin,
      // or profile edited) without forcing the user to sign out. Cheap lookup,
      // only when the client explicitly asks for a session refresh.
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, name: true, image: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Google sign-ups are created via the adapter (not registerAction), so they
      // still need a referral code of their own to share.
      if (user.id) {
        const cookieStore = await cookies();
        const signupSource = cookieStore.get("signup_source")?.value || "Direct";
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: generateReferralCode(), signupSource },
        });
      }
    },
    async signIn({ user, account }) {
      if (!user?.id) return;
      try {
        const ip = await getClientIp();
        await recordLoginActivity({
          userId: user.id,
          provider: account?.provider === "google" ? "google" : "credentials",
          ip,
        });
      } catch {
        // Best-effort — activity logging must never break sign-in.
      }
    },
  },
});
