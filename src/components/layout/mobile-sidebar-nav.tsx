"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar-content";

import HamburgerMenuIcon from "/public/images/icons/hamburger-menu.svg";

export function MobileSidebarNav() {
  const [isMobileSidebarNavOpen, setIsMobileSidebarNavOpen] =
    React.useState(false);

  return (
    <Sheet
      open={isMobileSidebarNavOpen}
      onOpenChange={setIsMobileSidebarNavOpen}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <HamburgerMenuIcon className="size-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="dir">
        <SidebarContent setIsMobileSidebarNavOpen={setIsMobileSidebarNavOpen} />
      </SheetContent>
    </Sheet>
  );
}
