import { i18n } from "@/configs/i18n";

import { ensurePrefix } from "@/lib/utils";

export const isPathnameMissingLocale = (pathname: string) => {
  return i18n.locales.every(
    (locale) =>
      !(pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`)
  );
};

export const ensureLocalizedPathname = (
  pathname: string,
  languageCode: string
): string => {
  // Ensure both pathname and languageCode are provided
  if (!pathname || !languageCode)
    throw new Error("Pathname or Language Code cannot be empty");

  // Add the locale prefix to the pathname if it is missing, otherwise return the original pathname
  return isPathnameMissingLocale(pathname)
    ? `${ensurePrefix(languageCode, "/")}${
        pathname === "/" ? "" : ensurePrefix(pathname, "/")
      }`
    : pathname;
};
