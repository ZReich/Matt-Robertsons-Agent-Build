import { i18n } from "@/configs/i18n";

import { ensureWithPrefix } from "@/lib/utils";

export const isPathnameMissingLocale = (pathname: string) => {
  return i18n.locales.every(
    (locale) =>
      !(pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`)
  );
};

export const ensureLocalizedPathname = (
  pathname: string,
  locale: string
): string => {
  // Ensure both pathname and locale are provided
  if (!pathname || !locale)
    throw new Error("Pathname or Locale cannot be empty");

  // Add the locale prefix to the pathname if it is missing, otherwise return the original pathname
  return isPathnameMissingLocale(pathname)
    ? `${ensureWithPrefix(locale, "/")}${
        pathname === "/" ? "" : ensureWithPrefix(pathname, "/")
      }`
    : pathname;
};

export const relocalizePathname = (pathname: string, locale: string) => {
  // Ensure both pathname and locale are provided
  if (!pathname || !locale)
    throw new Error("Pathname or Locale cannot be empty");

  const segments = pathname.split("/");
  segments[1] = locale;

  return segments.join("/");
};
