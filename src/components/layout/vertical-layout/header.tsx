"use client";

import type { DictionaryType } from "@/lib/getDictionary";

import { CommandMenu } from "@/components/layout/command-menu";
import { MobileSidebarNav } from "@/components/layout/mobile-sidebar-nav";
import { ModeDropdown } from "@/components/layout/mode-dropdown";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { LanguageDropdown } from "@/components/layout/language-dropdown";
import { Notifications } from "@/components/layout/notifications";
import { FullscreenToggle } from "@/components/full-screen-toggle";

export function Header({ dictionary }: { dictionary: DictionaryType }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        <CommandMenu />
        <div className="flex gap-2">
          <Notifications />
          <FullscreenToggle />
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserDropdown dictionary={dictionary} />
        </div>
      </div>
    </header>
  );
}
