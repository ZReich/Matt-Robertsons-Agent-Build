"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { groupNavs } from "@/data/navigation";

import { i18n, LocaleType } from "@/configs/i18n";

import { ensureLocalizedPathname } from "@/lib/i18n";

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

import Logo from "@/app/icon.svg";
import { Separator } from "@/components/ui/separator";

export function Header({ dictionary }: { dictionary: Dictionary }) {
  const params = useParams();
  const locale = params.lang as LocaleType;

  const dir = i18n.langDirection[locale];

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <div className="container hidden justify-between items-center px-6 py-1 md:flex">
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
      <Separator className="bg-accent h-[0.5px]" />
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        <Link
          href={ensureLocalizedPathname("/", locale)}
          className="hidden text-foreground font-black hover:text-primary/90 md:flex"
        >
          <Logo className="size-6" aira-hidden="true" />
          Shadboard
        </Link>
        <div className="flex gap-2">
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav dir={dir} locale={locale} />
        </div>
      </div>
    </header>
  );
}
