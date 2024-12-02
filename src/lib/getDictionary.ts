import "server-only";

import type { LocaleType } from "@/configs/i18n";

const dictionaries = {
  en: () =>
    import("@/data/dictionaries/en.json").then((module) => module.default),
  ar: () =>
    import("@/data/dictionaries/ar.json").then((module) => module.default),
};

export const getDictionary = async (locale: LocaleType) => dictionaries[locale]();

export type DictionaryType = Awaited<ReturnType<typeof getDictionary>>;
