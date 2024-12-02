"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { NavType } from "@/data/navigation";
import type { LocaleType } from "@/configs/i18n";

import {
  MenubarItem,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
} from "@/components/ui/menubar";
import { Badge } from "@/components/ui/badge";

export function Nav({ navs }: { navs: NavType[] }) {
  const pathname = usePathname();
  const params = useParams();

  const locale = params.lang as LocaleType;

  return (
    <>
      {navs.map((nav, index) => {
        const isActive = pathname.includes(nav.href);

        if (nav.children) {
          return (
            <MenubarSub key={index}>
              <MenubarSubTrigger
                className={cn(
                  "hover:cursor-pointer",
                  isActive &&
                    "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                )}
              >
                {nav.title}
                {nav.label && (
                  <Badge variant="secondary" className="ms-auto">
                    {nav.label}
                  </Badge>
                )}
              </MenubarSubTrigger>
              <MenubarSubContent>
                <Nav navs={nav.children as NavType[]} />
              </MenubarSubContent>
            </MenubarSub>
          );
        } else {
          return (
            <MenubarItem
              key={index}
              className={cn(
                "hover:cursor-pointer",
                isActive &&
                  "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground"
              )}
              asChild
            >
              <Link href={ensureLocalizedPathname(nav.href, locale)}>
                {nav.title}
                {nav.label && (
                  <Badge variant="secondary" className="ms-auto">
                    {nav.label}
                  </Badge>
                )}
              </Link>
            </MenubarItem>
          );
        }
      })}
    </>
  );
}
