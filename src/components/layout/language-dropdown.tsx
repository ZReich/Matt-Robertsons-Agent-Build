"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { GlobeIcon } from "@radix-ui/react-icons";

import { i18n } from "@/configs/i18n";

import type { Locale } from "@/configs/i18n";
import type { Dictionary } from "@/lib/getDictionary";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type LanguageDictionary = Dictionary["navigation"]["language"];

type LanguageDataType = {
  langCode: Locale;
  langName: keyof LanguageDictionary;
};

const getLocalePath = (pathName: string, locale: string) => {
  if (!pathName) return "/";
  const segments = pathName.split("/");

  segments[1] = locale;

  return segments.join("/");
};

const languageData: LanguageDataType[] = [
  {
    langCode: "en",
    langName: "english",
  },
  {
    langCode: "ar",
    langName: "arabic",
  },
];

export function LanguageDropdown({ dictionary }: { dictionary: Dictionary }) {
  const pathName = usePathname();
  const params = useParams();

  const locale = params.lang as Locale;
  const direction = i18n.langDirection[locale];

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <GlobeIcon aria-hidden />
          <span className="sr-only">
            {dictionary.navigation.language["select-language"]}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          {dictionary.navigation.language["language"]}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={locale}>
          {languageData.map((locale) => (
            <DropdownMenuRadioItem
              key={locale.langCode}
              value={locale.langCode}
            >
              <Link
                href={getLocalePath(pathName, locale.langCode)}
                className="w-full"
              >
                {dictionary.navigation.language[locale.langName]}
              </Link>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
