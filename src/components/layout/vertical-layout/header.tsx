"use client";

import { useParams } from "next/navigation";

import type { Dictionary } from "@/lib/getDictionary";
import type { LocaleType } from "@/configs/i18n";

import { i18n } from "@/configs/i18n";

import { CommandMenu } from "@/components/layout/command-menu";
import { MobileSidebarNav } from "@/components/layout/mobile-sidebar-nav";
import { ModeDropdown } from "@/components/layout/mode-dropdown";
import { UserNav } from "@/components/layout/user-nav";
import { LanguageDropdown } from "@/components/layout/language-dropdown";

export function Header({ dictionary }: { dictionary: Dictionary }) {
  const params = useParams();
  const locale = params.lang as LocaleType;

  const dir = i18n.langDirection[locale];

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        <CommandMenu />
        <div className="flex gap-2">
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav dir={dir} locale={locale} />
        </div>
      </div>
    </header>
  );
}
