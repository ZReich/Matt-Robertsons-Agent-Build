"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { navigationsData } from "@/data/navigations";

import { cn } from "@/lib/utils";
import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/configs/i18n";

import { DynamicIcon } from "@/components/dynamic-icon";
import { Badge } from "@/components/ui/badge";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";

export function TopBarHeaderMenubar() {
  const pathname = usePathname();
  const params = useParams();

  const locale = params.lang as LocaleType;

  return (
    <Menubar className="shadow-none border-0">
      {navigationsData.map((nav) => (
        <MenubarMenu key={nav.title}>
          <MenubarTrigger>{nav.title}</MenubarTrigger>
          <MenubarContent>
            {nav.items.map((item) => {
              const localizedPathname = ensureLocalizedPathname(
                item.href,
                locale
              );
              const isActive = pathname.includes(localizedPathname);

              return (
                <MenubarItem key={item.title} asChild>
                  <Link
                    href={localizedPathname}
                    className={cn("gap-2", isActive && "bg-accent")}
                  >
                    <DynamicIcon name={item.iconName} className="h-4 w-4" />
                    <span>{item.title}</span>
                    {"label" in item && (
                      <Badge variant="secondary">{item.label}</Badge>
                    )}
                  </Link>
                </MenubarItem>
              );
            })}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
