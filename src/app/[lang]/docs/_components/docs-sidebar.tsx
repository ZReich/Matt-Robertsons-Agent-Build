"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { sidebarNavigationData } from "../_data/sidebar-navigation";

import { i18n } from "@/configs/i18n";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType, NavigationRootItem } from "@/types";

import { useSettings } from "@/hooks/use-settings";

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

import Logo from "/public/images/icons/shadboard.svg";
import { isActivePathname } from "@/lib/utils";

export function DocsSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const { openMobile, setOpenMobile, isMobile } = useSidebar();

  const locale = params.lang as LocaleType;
  const direction = i18n.localeDirection[locale];
  const isRTL = direction === "rtl";

  return (
    <SidebarWrapper side={isRTL ? "right" : "left"}>
      <SidebarHeader className="md:hidden">
        <Link
          href={ensureLocalizedPathname("/", locale)}
          className="w-fit flex text-foreground font-black p-2 pb-0 mb-2 hover:text-primary/90"
          onClick={() => isMobile && setOpenMobile(!openMobile)}
        >
          <Logo className="size-6" aria-hidden />
          <span>Shadboard</span>
        </Link>
      </SidebarHeader>
      <ScrollArea>
        <SidebarContent className="gap-0 md:mt-16">
          {sidebarNavigationData.map((nav) => (
            <SidebarGroup key={nav.title}>
              <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.items.map((item: NavigationRootItem) => {
                    if (item.href) {
                      const localizedPathname = ensureLocalizedPathname(item.href, locale);
                      const isActive = isActivePathname(
                        localizedPathname,
                        pathname
                      );

                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton isActive={isActive} asChild>
                            <Link href={localizedPathname}>
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
