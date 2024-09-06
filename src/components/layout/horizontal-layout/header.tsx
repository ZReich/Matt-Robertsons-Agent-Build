"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMedia } from "react-use";

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
  const isMobile = useMedia("(max-width: 768px)");
  const params = useParams();
  const locale = params.lang as Locale;

  const dir = i18n.langDirection[locale];

  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b-[1px] border-accent">
      <Menubar
        className="hidden h-fit shadow-none border-0 border-b md:flex"
        dir={dir}
        asChild
      >
        <div className="container px-6">
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
        </div>
      </Menubar>
      <div className="container flex h-14 justify-between items-center gap-4">
        <MobileSidebarNav />
        {isMobile ? (
          <CommandMenu />
        ) : (
          <Link
            href={getLocalizedPathname("/", locale)}
            className="flex text-foreground font-black hover:text-primary/90"
          >
            <ShadboardLogo className="size-6" aira-hidden="true" />
            Shadboard
          </Link>
        )}
        <div className="flex gap-2">
          {!isMobile && <CommandMenu />}
          <ModeDropdown dictionary={dictionary} />
          <LanguageDropdown dictionary={dictionary} />
          <UserNav dir={dir} />
        </div>
      </div>
    </header>
  );
}
