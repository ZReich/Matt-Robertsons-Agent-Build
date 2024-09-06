"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { groupNavs } from "@/data/navigation";

import { i18n, Locale } from "@/configs/i18n";

import { getLocalizedPathname } from "@/lib/i18n";

import type { Dictionary } from "@/lib/getDictionary";

import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { MobileSidebarNav } from "@/components/layout/mobile-sidebar-nav";
import { CommandMenu } from "@/components/layout/command-menu";
import { ModeDropdown } from "@/components/layout/mode-dropdown";
import { LanguageDropdown } from "@/components/layout/language-dropdown";
import { UserNav } from "@/components/layout/user-nav";
import { Nav } from "./nav";

import ShadboardLogo from "/public/images/logos/shadboard.svg";

export function Header({ dictionary }: { dictionary: Dictionary }) {
  const params = useParams();
  const locale = params.lang as Locale;

  const dir = i18n.langDirection[locale];

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <div className="container flex justify-between items-center px-6 py-1 border-0 border-b md:flex">
        <Menubar className="shadow-none border-0" dir={dir}>
          {groupNavs.map((group, index) => (
            <MenubarMenu key={index}>
              <MenubarTrigger className="gap-2 hover:cursor-pointer focus:bg-primary focus:text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground">
                {group.title}
              </MenubarTrigger>
              <MenubarContent>
                <Nav navs={group.navs} />
              </MenubarContent>
            </MenubarMenu>
          ))}
        </Menubar>
        <CommandMenu />
      </div>
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        <Link
          href={getLocalizedPathname("/", locale)}
          className="hidden text-foreground font-black hover:text-primary/90 md:flex"
        >
          <ShadboardLogo className="size-6" aira-hidden="true" />
          Shadboard
        </Link>
        <div className="flex gap-2">
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav dir={dir} />
        </div>
      </div>
    </header>
  );
}
