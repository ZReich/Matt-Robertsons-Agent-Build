"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { sidebarNavigationData } from "../_data/sidebar-navigation";

import { isActivePathname } from "@/lib/utils";

import type { NavigationRootItem } from "@/types";

import {
  Sidebar as SidebarWrapper,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DocsSidebar() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile, isMobile } = useSidebar();

  return (
    <SidebarWrapper className="sticky top-[4.25rem] h-svh" collapsible="none">
      <SidebarHeader className={openMobile && isMobile ? "" : "hidden"}>
        <Link
          href="/"
          className="w-fit flex text-foreground font-black p-2 pb-0 mb-2 hover:text-primary/90"
          onClick={() => isMobile && setOpenMobile(!openMobile)}
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
      </SidebarHeader>
      <ScrollArea>
        <SidebarContent className="gap-0">
          {sidebarNavigationData.map((nav) => (
            <SidebarGroup key={nav.title}>
              <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.items.map((item: NavigationRootItem) => {
                    if (item.href) {
                      const isActive = isActivePathname(item.href, pathname);

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setOpenMobile(!openMobile)}
                            asChild
                          >
                            <Link href={item.href}>
                              <span>{item.title}</span>
                              {"label" in item && (
                                <Badge variant="secondary">{item.label}</Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </ScrollArea>
    </SidebarWrapper>
  );
}
