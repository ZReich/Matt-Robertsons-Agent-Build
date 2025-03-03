import { i18n } from "@/configs/i18n";

import { ensureWithPrefix } from "@/lib/utils";

export function isPathnameMissingLocale(pathname: string) {
  return !i18n.locales.some((locale) => pathname.startsWith(`/${locale}`));
}

export function getLocaleFromPathname(pathname: string) {
  return i18n.locales.find((locale) => pathname.startsWith(`/${locale}`));
}

export function ensureLocalizedPathname(pathname: string, locale: string) {
  // Ensure both pathname and locale are provided
  if (!pathname || !locale)
    throw new Error("Pathname or Locale cannot be empty");

  // Add the locale prefix to the pathname if it is missing, otherwise return the original pathname
  return isPathnameMissingLocale(pathname)
    ? `${ensureWithPrefix(locale, "/")}${ensureWithPrefix(pathname, "/")}`
    : pathname;
}

export function relocalizePathname(pathname: string, locale: string) {
  // Ensure both pathname and locale are provided
  if (!pathname || !locale)
    throw new Error("Pathname or Locale cannot be empty");

  const segments = pathname.split("/");
  segments[1] = locale;

  return segments.join("/");
}
