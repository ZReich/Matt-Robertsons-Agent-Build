"use client";

import { useParams } from "next/navigation";

import type { DictionaryType } from "@/lib/getDictionary";
import type { LocaleType } from "@/types";

import { CommandMenu } from "@/components/layout/command-menu";
import { ModeDropdown } from "@/components/layout/mode-dropdown";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { LanguageDropdown } from "@/components/layout/language-dropdown";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { FullscreenToggle } from "@/components/layout/full-screen-toggle";
import { ToggleMobileSidebar } from "../toggle-moble-sidebar";

export function VerticalLayoutHeader({
  dictionary,
}: {
  dictionary: DictionaryType;
}) {
  const params = useParams();

  const locale = params.lang as LocaleType;

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border">
      <div className="container flex h-14 justify-between items-center gap-4">
        <ToggleMobileSidebar />
        <div className="grow flex justify-end gap-2">
          <CommandMenu dictionary={dictionary} buttonClassName="lg:me-auto" />
          <NotificationDropdown dictionary={dictionary} />
          <FullscreenToggle />
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserDropdown dictionary={dictionary} locale={locale} />
        </div>
      </div>
    </header>
  );
}
