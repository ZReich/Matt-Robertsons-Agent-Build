"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMedia } from "react-use";

import { groupNavs } from "@/data/navigation";

import { i18n } from "@/configs/i18n";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/configs/i18n";
import type { DictionaryType } from "@/lib/getDictionary";

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
import { Separator } from "@/components/ui/separator";
import { Nav } from "./nav";
import { Notifications } from "../notifications";

import Logo from "@/app/icon.svg";

export function Header({ dictionary }: { dictionary: DictionaryType }) {
  const params = useParams();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");

  const locale = params.lang as LocaleType;

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <div className="container hidden justify-between items-center py-1 md:flex">
        <Menubar className="shadow-none border-0">
          {groupNavs.map((group, index) => (
            <MenubarMenu key={index}>
              <MenubarTrigger className="gap-2 hover:cursor-pointer focus:bg-primary focus:text-primary-foreground data-[state=open]:bg-primary data-[state=open]:text-primary-foreground">
                {group.name}
              </MenubarTrigger>
              <MenubarContent>
                <Nav navs={group.navs} />
              </MenubarContent>
            </MenubarMenu>
          ))}
        </Menubar>
        <CommandMenu />
      </div>
      <Separator className="hidden bg-accent h-[0.5px] md:block" />
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        <Link
          href={ensureLocalizedPathname("/", locale)}
          className="hidden text-foreground font-black hover:text-primary/90 md:flex"
        >
          <Logo className="size-6" aira-hidden="true" />
          Shadboard
        </Link>
        {isMediumOrSmaller && <CommandMenu />}
        <div className="flex gap-2">
          <Notifications />
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav dictionary={dictionary} />
        </div>
      </div>
    </header>
  );
}
