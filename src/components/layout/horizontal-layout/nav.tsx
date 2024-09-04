"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { Nav as NavType } from "@/data/navigation";

import {
  MenubarItem,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
} from "@/components/ui/menubar";
import { Badge } from "@/components/ui/badge";

export function Nav({ navs }: { navs: NavType[] }) {
  const pathname = usePathname();

  return (
    <>
      {navs.map((nav, index) => {
        const localizedHref = getLocalizedPathname(
          nav.href,
          pathname.slice(0, 3) // Language code.
        );
        const isActive = localizedHref === pathname;

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
              <Link href={nav.href}>
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
