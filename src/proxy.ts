import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Paths that require authentication (without locale prefix)
const protectedPaths = ["/dashboard"];

function isProtected(pathname: string): boolean {
  // Strip locale prefix to check against protected paths
  const strippedPath = pathname.replace(/^\/(en|he)/, "") || "/";
  return protectedPaths.some(
    (p) => strippedPath === p || strippedPath.startsWith(p + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If the path has no locale prefix, let the i18n middleware redirect first
  // (e.g. /dashboard → /en/dashboard) before we check auth.
  // This avoids auth-checking on the bare path during post-login redirects.
  const localeMatch = pathname.match(/^\/(en|he)/);
  if (!localeMatch) {
    return intlMiddleware(request);
  }

  const locale = localeMatch[1];

  // Check if this is a protected route
  if (isProtected(pathname)) {
    const isSecure = request.nextUrl.protocol === "https:";
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: isSecure,
    });

    if (!token) {
      const signInUrl = new URL(`/${locale}/auth/signin`, request.url);
      signInUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(signInUrl);
    }

    // Block disabled (banned) users from protected routes
    if (token.disabled) {
      const disabledUrl = new URL(`/${locale}/auth/signin`, request.url);
      disabledUrl.searchParams.set("error", "disabled");
      return NextResponse.redirect(disabledUrl);
    }
  }

  // Run i18n middleware for locale detection and routing
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
