import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import Negotiator from "negotiator";
import { match as matchLocale } from "@formatjs/intl-localematcher";

import { i18n, Locale } from "@/configs/i18n";

import { isPathnameMissingLocale, getLocalizedPathname } from "@/lib/i18n";
import { withoutSuffix } from "@/lib/utils";

import type { NextRequest } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

const HOME_PAGE_PATHNAME = "/dashboards/analytics";

const getLocale = (request: NextRequest) => {
  // Try to get locale from pathname
  const pathnameLocale = i18n.locales.find((locale) =>
    request.nextUrl.pathname.startsWith(`/${locale}`)
  );

  if (pathnameLocale) return pathnameLocale;

  // Negotiator expects plain object so we need to transform headers
  const negotiatorHeaders: Record<string, string> = {};

  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

  // @ts-ignore locales are readonly
  const locales: string[] = i18n.locales;

  // Use negotiator and intl-localematcher to get best locale
  const languages = new Negotiator({ headers: negotiatorHeaders }).languages(
    locales
  );

  const locale = matchLocale(languages, locales, i18n.defaultLocale);

  return locale as Locale;
};

function redirectTo(pathname: string, request: NextRequest, locale?: Locale) {
  let redirectPathname = pathname;

  // Localize the pathname if it's missing a locale
  if (isPathnameMissingLocale(pathname)) {
    redirectPathname = getLocalizedPathname(
      pathname,
      locale ?? i18n.defaultLocale
    );
  }

  // Create and return a redirect response
  const redirectUrl = new URL(redirectPathname, request.url).toString();
  return NextResponse.redirect(redirectUrl);
}

function getFirstSegment(pathname: string) {
  // Split the pathname by '/' and filter out empty segments
  const segments = pathname.split("/").filter(Boolean);

  // Return the next segment if the first one is a locale
  return i18n.locales.includes(segments[0] as Locale)
    ? segments[1]
    : segments[0];
}

export default withAuth(
  async function middleware(request: NextRequestWithAuth) {
    const { pathname } = request.nextUrl;
    const locale = getLocale(request);
    const isUserAuthenticated = !!request.nextauth.token;

    const guestRoutes = ["sign-in", "register", "forgot-password"];
    const commonRoutes = ["common-route"];
    const currentRoute = getFirstSegment(pathname);
    const isGuestRoute = guestRoutes.includes(currentRoute);
    const isCommonRoute = commonRoutes.includes(currentRoute);
    const isProtectedRoute = !isCommonRoute && !isGuestRoute;

    // Redirect unauthenticated users from protected routes to sign-in
    if (!isUserAuthenticated && isProtectedRoute) {
      let redirectPathname = "/sign-in";

      // Maintain the original path for redirection
      if (!(pathname === "/" || pathname === `/${locale}`)) {
        const searchParams = new URLSearchParams({
          redirectTo: withoutSuffix(pathname, "/"),
        });

        redirectPathname += `?${searchParams}`;
      }

      return redirectTo(redirectPathname, request, locale);
    }

    // Redirect authenticated users away from guest routes
    if (isUserAuthenticated && isGuestRoute) {
      return redirectTo(HOME_PAGE_PATHNAME, request, locale);
    }

    // Redirect to home page if the request is for the root or locale root
    if (pathname === "/" || pathname === `/${locale}`) {
      return redirectTo(HOME_PAGE_PATHNAME, request, locale);
    }

    // Redirect to loclized url if the pathname is missing a locale
    if (isPathnameMissingLocale(pathname)) {
      return redirectTo(pathname, request, locale);
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
