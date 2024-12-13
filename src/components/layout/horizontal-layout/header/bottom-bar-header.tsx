"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMedia } from "react-use";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/configs/i18n";
import type { DictionaryType } from "@/lib/getDictionary";

import { MobileSidebarNav } from "@/components/layout/mobile-sidebar-nav";
import { CommandMenu } from "@/components/layout/command-menu";
import { ModeDropdown } from "@/components/layout/mode-dropdown";
import { LanguageDropdown } from "@/components/layout/language-dropdown";
import { UserDropdown } from "@/components/layout/user-dropdown";
import { Notifications } from "@/components/layout/notifications";
import { FullscreenToggle } from "@/components/full-screen-toggle";

import Logo from "/public/images/icons/shadboard.svg";

export function BottomBarHeader({
  dictionary,
}: {
  dictionary: DictionaryType;
}) {
  const params = useParams();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");

  const locale = params.lang as LocaleType;

  return (
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
        <FullscreenToggle />
        <ModeDropdown dictionary={dictionary} />
        <LanguageDropdown dictionary={dictionary} />
        <UserDropdown dictionary={dictionary} locale={locale} />
      </div>
    </div>
  );
}
