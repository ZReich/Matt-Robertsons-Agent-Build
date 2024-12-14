"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
          className="px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <HamburgerMenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="start">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>
            Use the menu to navigate through the site.
          </SheetDescription>
        </SheetHeader>
        <SidebarContent setIsMobileSidebarNavOpen={setIsMobileSidebarNavOpen} />
      </SheetContent>
    </Sheet>
  );
}
