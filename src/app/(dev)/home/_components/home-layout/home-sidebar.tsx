"use client";

import Link from "next/link";
import { PanelLeft } from "lucide-react";

import { homeNavigationsData } from "../../_data/home-navigations";

import { isActivePathname } from "@/lib/utils";

import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import Logo from "/public/images/icons/shadboard.svg";

export function HomeSidebar({ fullPathname }: { fullPathname: string }) {
  const { openMobile, setOpenMobile, isMobile } = useSidebar();

  if (!isMobile) return;

  return (
    <Sheet open={openMobile} onOpenChange={setOpenMobile}>
      <SheetTrigger>
        <Button
          data-sidebar="trigger"
          variant="ghost"
          size="icon"
          onClick={() => setOpenMobile(!openMobile)}
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 [&>button]:hidden">
        <SheetHeader>
          {/* <SheetTitle>Are you absolutely sure?</SheetTitle>
          <SheetDescription>
            This action cannot be undone. This will permanently delete your
            account and remove your data from our servers.
          </SheetDescription> */}
          <SidebarHeader>
            <Link
              href="/"
              className="w-fit flex text-foreground font-black p-2 pb-0 mb-2 hover:text-primary/90"
              onClick={() => isMobile && setOpenMobile(!openMobile)}
            >
              <Logo className="size-6" aria-hidden />
              <span>Shadboard</span>
            </Link>
          </SidebarHeader>
        </SheetHeader>
        <ScrollArea className="p-2">
          <SidebarContent>
            <SidebarMenu>
              {homeNavigationsData.map((nav) => {
                const isActive = isActivePathname(nav.href, fullPathname, true);

                if (nav.href) {
                  return (
                    <SidebarMenuItem key={nav.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setOpenMobile(!openMobile)}
                        asChild
                      >
                        <Link href={nav.href}>
                          <span>{nav.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              })}
            </SidebarMenu>
          </SidebarContent>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
