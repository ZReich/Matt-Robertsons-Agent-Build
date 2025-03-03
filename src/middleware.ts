import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";

import { i18n } from "@/configs/i18n";
import { isGuestRoute, isProtectedRoute } from "@/configs/routes";

import { isPathnameMissingLocale, getLocaleFromPathname } from "@/lib/i18n";
import { ensureRedirectPathname, ensureWithoutPrefix } from "@/lib/utils";

import type { LocaleType } from "@/types";
import type { NextRequest } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

function getPreferredLocale(request: NextRequest) {
  const settingsCookie = request.cookies.get("settings")?.value;
  try {
    const parsedSettingsCookie = settingsCookie && JSON.parse(settingsCookie);

    // Return locale from settings cookie if available
    if (parsedSettingsCookie?.locale) {
      return parsedSettingsCookie.locale as LocaleType;
    }
  } catch (error) {
    console.error("Failed to parse settings cookie", error);
  }

  const supportedLocales = [...i18n.locales];
  const preferredLocales = new Negotiator({
    headers: Object.fromEntries(request.headers.entries()),
  }).languages(supportedLocales);

  // Match preferred locales with supported locales
  const locale = match(preferredLocales, supportedLocales, i18n.defaultLocale);

  return locale as LocaleType;
}

function redirectTo(pathname: string, request: NextRequest) {
  let redirectPathname = pathname;

  // Add locale to pathname if it's missing
  if (isPathnameMissingLocale(pathname)) {
    const preferredLocale = getPreferredLocale(request);
    redirectPathname = "/" + preferredLocale + pathname;
  }

  const redirectUrl = new URL(redirectPathname, request.url).toString();
  return NextResponse.redirect(redirectUrl);
}

export default withAuth(
  async function middleware(request: NextRequestWithAuth) {
    const { pathname } = request.nextUrl;

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
        redirectPathname = ensureRedirectPathname(redirectPathname, pathname);
      }

      return redirectTo(redirectPathname, request);
    }

    // Redirect authenticated users away from guest routes
    if (isAuthenticated && isGuestRoute(pathnameWithoutLocale)) {
      return redirectTo(process.env.HOME_PATHNAME || "/", request);
    }

    // Redirect to home page if the request is for the root or locale root
    if (pathnameWithoutLocale === "") {
      return redirectTo(process.env.HOME_PATHNAME || "/", request);
    }

    // Redirect to localized URL if the pathname is missing a locale
    if (locale === undefined) {
      return redirectTo(pathname, request);
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
