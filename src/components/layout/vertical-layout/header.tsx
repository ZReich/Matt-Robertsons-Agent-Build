import type { Dictionary } from "@/lib/getDictionary";

import { CommandMenu } from "@/components/layout/command-menu";
import { MobileSidebarNav } from "@/components/layout/mobile-sidebar-nav";
import { ModeDropdown } from "@/components/layout/mode-dropdown";
import { UserNav } from "@/components/layout/user-nav";
import { LanguageDropdown } from "@/components/layout/language-dropdown";

export function Header({ dictionary }: { dictionary: Dictionary }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        <CommandMenu />
        <div className="flex gap-2">
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
