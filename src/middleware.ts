import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import Negotiator from "negotiator";
import { match } from "@formatjs/intl-localematcher";

import { i18n } from "@/configs/i18n";

import { isPathnameMissingLocale, ensureLocalizedPathname } from "@/lib/i18n";
import { withoutSuffix } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";
import type { NextRequest } from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";

const HOME_PATHNAME = "/dashboards/analytics";

const getLocale = (request: NextRequest) => {
  const settingsCookie = request.cookies.get("settings")?.value;
  try {
    const parsedSettingsCookie = settingsCookie && JSON.parse(settingsCookie);

    if (parsedSettingsCookie?.locale) {
      return parsedSettingsCookie.locale as LocaleType;
    }
  } catch (error) {
    console.error("Failed to parse settings cookie:", error);
  }

  const { pathname } = request.nextUrl;
  const pathnameLocale = i18n.locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  if (pathnameLocale) return pathnameLocale;

  const supportedLocales = [...i18n.locales];
  const preferredLocales = new Negotiator({
    headers: Object.fromEntries(request.headers.entries()),
  }).languages(supportedLocales);

  const locale = match(preferredLocales, supportedLocales, i18n.defaultLocale);

  return locale as LocaleType;
};

function redirectTo(
  pathname: string,
  request: NextRequest,
  locale?: LocaleType
) {
  let redirectPathname = pathname;

  if (isPathnameMissingLocale(pathname)) {
    redirectPathname = ensureLocalizedPathname(
      pathname,
      locale ?? i18n.defaultLocale
    );
  }

  const redirectUrl = new URL(redirectPathname, request.url).toString();
  return NextResponse.redirect(redirectUrl);
}

function getFirstSegment(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  return i18n.locales.includes(segments[0] as LocaleType)
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
      return redirectTo(HOME_PATHNAME, request, locale);
    }

    // Redirect to home page if the request is for the root or locale root
    if (pathname === "/" || pathname === `/${locale}`) {
      return redirectTo(HOME_PATHNAME, request, locale);
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
