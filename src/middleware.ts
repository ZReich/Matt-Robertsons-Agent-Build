import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

import { isGuestRoute, isProtectedRoute } from "@/lib/auth-routes";
import {
  isPathnameMissingLocale,
  getLocaleFromPathname,
  getPreferredLocale,
  ensureLocalizedPathname,
} from "@/lib/i18n";
import {
  ensureRedirectPathname,
  ensureWithoutPrefix,
  ensureWithSuffix,
} from "@/lib/utils";

import type { NextRequestWithAuth } from "next-auth/middleware";

function redirect(pathname: string, request: NextRequestWithAuth) {
  let resolvedPathname = pathname;

  if (isPathnameMissingLocale(pathname)) {
    const preferredLocale = getPreferredLocale(request);
    resolvedPathname = ensureLocalizedPathname(pathname, preferredLocale);
  }

  const redirectUrl = new URL(resolvedPathname, request.url).toString();
  return NextResponse.redirect(redirectUrl);
}

export default withAuth(
  async function middleware(request: NextRequestWithAuth) {
    const { pathname, search } = request.nextUrl;

    if (pathname.startsWith("/home") || pathname.startsWith("/docs")) {
      return NextResponse.next();
    }

    const locale = getLocaleFromPathname(pathname);
    const pathnameWithoutLocale = ensureWithoutPrefix(pathname, `/${locale}`);
    const isAuthenticated = !!request.nextauth.token;

    // Redirect unauthenticated users from protected routes to sign-in
    if (!isAuthenticated && isProtectedRoute(pathnameWithoutLocale)) {
      let redirectPathname = "/sign-in";

      // Maintain the original path for redirection
      if (pathnameWithoutLocale !== "") {
        redirectPathname = ensureRedirectPathname(
          redirectPathname,
          ensureWithSuffix(pathname, search)
        );
      }

      return redirect(redirectPathname, request);
    }

    // Redirect authenticated users away from guest routes
    if (isAuthenticated && isGuestRoute(pathnameWithoutLocale)) {
      return redirect(process.env.HOME_PATHNAME || "/", request);
    }

    // Redirect to home page if the request is for the root or locale root
    if (pathnameWithoutLocale === "") {
      return redirect(process.env.HOME_PATHNAME || "/", request);
    }

    // Redirect to localized URL if the pathname is missing a locale
    if (locale === undefined) {
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
