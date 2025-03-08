import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

import { isGuestRoute, isPublicRoute } from "@/lib/auth-routes";
import {
  isPathnameMissingLocale,
  getLocaleFromPathname,
  getPreferredLocale,
  ensureLocalizedPathname,
} from "@/lib/i18n";
import { ensureRedirectPathname, ensureWithoutPrefix } from "@/lib/utils";

import type { NextRequestWithAuth } from "next-auth/middleware";

function redirect(pathname: string, request: NextRequestWithAuth) {
  const { search, hash } = request.nextUrl;
  let resolvedPathname = pathname;

  if (isPathnameMissingLocale(pathname)) {
    const preferredLocale = getPreferredLocale(request);
    resolvedPathname = ensureLocalizedPathname(pathname, preferredLocale);
  }
  if (search) {
    resolvedPathname += search;
  }
  if (hash) {
    resolvedPathname += hash;
  }

  const redirectUrl = new URL(resolvedPathname, request.url).toString();
  return NextResponse.redirect(redirectUrl);
}

export default withAuth(
  async function middleware(request: NextRequestWithAuth) {
    const { pathname } = request.nextUrl;

    const locale = getLocaleFromPathname(pathname);
    const pathnameWithoutLocale = ensureWithoutPrefix(pathname, `/${locale}`);

    // Handle authentication for protected and guest routes
    if (!isPublicRoute(pathnameWithoutLocale)) {
      const isAuthenticated = !!request.nextauth.token;
      const isGuest = isGuestRoute(pathnameWithoutLocale);
      const isProtected = !isGuest;

      // Redirect authenticated users away from guest routes
      if (isAuthenticated && isGuest) {
        return redirect(process.env.HOME_PATHNAME || "/", request);
      }

      // Redirect unauthenticated users from protected routes to sign-in
      if (!isAuthenticated && isProtected) {
        let redirectPathname = "/sign-in";

        // Maintain the original path for redirection
        if (pathnameWithoutLocale !== "") {
          redirectPathname = ensureRedirectPathname(redirectPathname, pathname);
        }

        return redirect(redirectPathname, request);
      }
    }

    if (pathname.startsWith("/home") || pathname.startsWith("/docs")) {
      return NextResponse.next();
    }

    // Redirect to home if accessing the root or locale root
    if (!pathnameWithoutLocale) {
      return redirect(process.env.HOME_PATHNAME || "/", request);
    }

    // Redirect to localized URL if the pathname is missing a locale
    if (!locale) {
      return redirect(pathname, request);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Always authorize requests to ensure the middleware function is called
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - images folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images).*)",
  ],
};
