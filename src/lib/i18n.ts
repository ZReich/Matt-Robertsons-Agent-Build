import { i18n } from "@/configs/i18n";

import { ensurePrefix } from "@/lib/utils";

// Check if there is any supported locale in the pathname
export const isPathnameMissingLocale = (pathname: string) => {
  return i18n.locales.every(
    (locale) =>
      !(pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`)
  );
};

// Get the localized pathname
export const getLocalizedPathname = (
  pathname: string,
  languageCode: string
): string => {
  if (!pathname || !languageCode)
    throw new Error("Pathname or Language Code cannot be empty");

  return isPathnameMissingLocale(pathname)
    ? `${ensurePrefix(languageCode, "/")}${
        pathname === "/" ? "" : ensurePrefix(pathname, "/")
      }`
    : pathname;
};
