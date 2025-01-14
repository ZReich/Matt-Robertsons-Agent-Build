import Link from "next/link";
import React from "react";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/types";

import { ToggleMobileSidebar } from "./toggle-moble-sidebar";

import Logo from "/public/images/icons/shadboard.svg";

export function Header({ locale }: { locale: LocaleType }) {
  return (
    <header className="fixed top-0 w-full flex justify-between items-center bg-background p-4 border-b-[1px] border-sidebar-border z-50">
      <Link
        href={ensureLocalizedPathname("/docs", locale)}
        className="inline-flex text-foreground font-black hover:text-primary/90"
      >
        <Logo className="size-6" aira-hidden />
        Shadboard
      </Link>
      <ToggleMobileSidebar />
    </header>
  );
}
