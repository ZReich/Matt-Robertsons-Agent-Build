import * as React from "react";
import Link from "next/link";
import Image from "next/image";

import { ToggleMobileSidebar } from "./toggle-mobile-sidebar";
import { DocsCommandMenu } from "./docs-command-menu";
import { ModeDropdown } from "../../_components/mode-dropdown";

export function Header() {
  return (
    <header className="sticky top-0 w-full bg-background z-50">
      <div className="container flex justify-between items-center gap-2 p-4">
        <Link
          href="/docs"
          className="inline-flex text-foreground font-black hover:text-primary/90"
        >
          <Image
            src="/images/icons/shadboard.svg"
            alt=""
            height={24}
            width={24}
            className="dark:invert"
          />
          <span>Shadboard</span>
        </Link>
        <DocsCommandMenu buttonClassName="ms-auto" />
        <ModeDropdown />
        <ToggleMobileSidebar />
      </div>
    </header>
  );
}
