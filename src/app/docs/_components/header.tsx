import Link from "next/link";
import * as React from "react";

import { ToggleMobileSidebar } from "./toggle-moble-sidebar";
import { DocsCommandMenu } from "./docs-command-menu";
import { DocsModeDropdown } from "./docs-mode-dropdown";

import Logo from "/public/images/icons/shadboard.svg";

export function Header() {
  return (
    <header className="container fixed top-0 w-full flex justify-between items-center gap-2 p-4 bg-background border-b-[1px] border-sidebar-border z-[50]">
      <Link
        href="/docs"
        className="inline-flex text-foreground font-black hover:text-primary/90"
      >
        <Logo className="size-6" aira-hidden />
        Shadboard
      </Link>
      <DocsCommandMenu buttonClassName="ms-auto" />
      <DocsModeDropdown />
      <ToggleMobileSidebar />
    </header>
  );
}
