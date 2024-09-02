import { Dictionary } from "@/lib/getDictionary";

import { CommandMenu } from "@/components/command-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeDropdown } from "@/components/layout/theme-dropdown";
import { UserNav } from "@/components/layout/user-nav";
import { LanguageDropdown } from "@/components/layout/language-dropdown";

export function Header({ dictionary }: { dictionary: Dictionary }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="container flex h-14 max-w-screen-2xl justify-between items-center gap-4">
        <MobileNav />
        <CommandMenu />
        <div className="flex gap-2">
          <ThemeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav />
        </div>
      </div>
    </header>
  );
}
