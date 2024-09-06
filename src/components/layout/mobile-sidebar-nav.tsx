import HamburgerMenuIcon from "/public/images/icons/hamburger-menu.svg";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar-content";

export function MobileSidebarNav() {
  return (
    <Sheet>
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
        <SidebarContent />
      </SheetContent>
    </Sheet>
  );
}
