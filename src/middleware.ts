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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  if (isProtected(pathname)) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if (!token) {
      // Extract locale from pathname or use default
      const localeMatch = pathname.match(/^\/(en|he)/);
      const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

      const signInUrl = new URL(`/${locale}/auth/signin`, request.url);
      signInUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Run i18n middleware for locale detection and routing
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
