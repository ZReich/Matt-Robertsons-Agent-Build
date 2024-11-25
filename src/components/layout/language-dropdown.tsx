"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Earth } from "lucide-react";

import { i18n } from "@/configs/i18n";

import type { LocaleType } from "@/configs/i18n";
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
  langCode: LocaleType;
  langName: keyof LanguageDictionary;
};

const relocalizePathname = (pathname: string, locale: string) => {
  if (!pathname) return "/";
  const segments = pathname.split("/");

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
  const pathname = usePathname();
  const params = useParams();

  const locale = params.lang as LocaleType;
  const direction = i18n.langDirection[locale];

  return (
    <DropdownMenu dir={direction}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Earth className="size-4" aria-hidden />
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
            <Link
              key={locale.langCode}
              href={relocalizePathname(pathname, locale.langCode)}
            >
              <DropdownMenuRadioItem
                value={locale.langCode}
                className="hover:cursor-pointer"
              >
                {dictionary.navigation.language[locale.langName]}
              </DropdownMenuRadioItem>
            </Link>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
