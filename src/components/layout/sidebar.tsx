"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { navigationsData } from "@/data/navigations";

import { i18n } from "@/configs/i18n";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { titleCaseToCamelCase } from "@/lib/utils";

import type { LocaleType } from "@/types";
import type { DictionaryType } from "@/lib/getDictionary";

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
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import Logo from "/public/images/icons/shadboard.svg";

export function Sidebar({ dictionary }: { dictionary: DictionaryType }) {
  const pathname = usePathname();
  const params = useParams();
  const { openMobile, setOpenMobile, isMobile } = useSidebar();
  const { settings } = useSettings();

  const locale = params.lang as LocaleType;
  const direction = i18n.localeDirection[locale];
  const isRTL = direction === "rtl";
  const isHoizontalAndDesktop = settings.layout === "horizontal" && !isMobile;

  if (isHoizontalAndDesktop) return;

  return (
    <SidebarWrapper side={isRTL ? "right" : "left"}>
      <SidebarHeader>
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
        <SidebarContent className="gap-0">
          {navigationsData.map((nav) => (
            <SidebarGroup key={nav.title}>
              <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.items.map((item) => {
                    const localizedPathname = ensureLocalizedPathname(
                      item.href,
                      locale
                    );
                    const formattedTitle = titleCaseToCamelCase(item.title);
                    const formattedLabel = titleCaseToCamelCase(
                      item.label ?? ""
                    );

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          isActive={pathname.includes(localizedPathname)}
                          asChild
                        >
                          <Link href={localizedPathname}>
                            <DynamicIcon name={item.iconName} />
                            <span>
                              {
                                // @ts-ignore
                                dictionary.navigation[formattedTitle]
                              }
                            </span>
                            {"label" in item && (
                              <Badge variant="secondary">
                                {
                                  // @ts-ignore
                                  dictionary.navigation.label[formattedLabel]
                                }
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
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
