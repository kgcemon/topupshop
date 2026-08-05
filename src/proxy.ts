import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveSignupSource } from "@/lib/signup-source";

const SIGNUP_SOURCE_COOKIE = "signup_source";

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isAdminRoute = pathname.startsWith("/admin");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isAuthEntryRoute = pathname === "/register" || pathname === "/login";

  if (!session?.user && (isAdminRoute || isDashboardRoute)) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute) {
    const role = session?.user?.role;
    // Managers only get order viewing/status-changing rights — bounce them to
    // /admin/orders for every other admin route instead of /dashboard, since
    // they do belong in the admin panel, just not anywhere else in it.
    if (role === "MANAGER") {
      if (!pathname.startsWith("/admin/orders")) {
        return NextResponse.redirect(new URL("/admin/orders", req.nextUrl));
      }
    } else if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
  }

  const response = NextResponse.next();

  // Capture attribution on the first touch of /register or /login only —
  // never overwrite it on later visits — so registerAction/auth.ts can read
  // it back when the account is actually created.
  if (isAuthEntryRoute && !req.cookies.get(SIGNUP_SOURCE_COOKIE)) {
    const source = resolveSignupSource(req.headers.get("referer"), req.nextUrl.hostname);
    response.cookies.set(SIGNUP_SOURCE_COOKIE, source, {
      maxAge: 60 * 30,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/register", "/login"],
};
