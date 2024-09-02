import { NextResponse, type NextRequest } from "next/server";
import Negotiator from "negotiator";
import { match as matchLocale } from "@formatjs/intl-localematcher";

import { i18n } from "@/configs/i18n";

import { isPathnameMissingLocale, getLocalizedPathname } from "@/lib/i18n";

const getLocale = (request: NextRequest): string | undefined => {
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

  return locale;
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if there is any supported locale in the pathname
  if (!isPathnameMissingLocale(pathname)) return;

  // Redirect if there is no locale
  const locale = getLocale(request);
  request.nextUrl.pathname = getLocalizedPathname(
    pathname,
    locale ?? i18n.defaultLocale
  );
  // e.g. incoming request is /products
  // The new URL is now /en-US/products
  return NextResponse.redirect(request.nextUrl);
}

// Matcher Config
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - all items inside the public folder
     *    - images (public images)
     *    - next.svg (Next.js logo)
     *    - vercel.svg (Vercel logo)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.+?/hook-examples|.+?/menu-examples|images|next.svg|vercel.svg).*)",
  ],
};
