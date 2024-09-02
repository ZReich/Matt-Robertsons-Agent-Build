"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, DotIcon } from "@radix-ui/react-icons";

import type { Nav as NavType } from "@/data/navigation";
import { Direction } from "@/types";

import { cn } from "@/lib/utils";
import { getLocalizedPathname } from "@/lib/i18n";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavProps {
  navs: NavType[];
  dir: Direction;
  isRoot?: boolean;
}

export function Nav({ navs, dir, isRoot = true }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1" dir={dir}>
      {navs.map((nav) => {
        const localizedHref = getLocalizedPathname(
          nav.href,
          pathname.slice(0, 3) // Language code.
        );
        // Exact match for home page to avoid false positives; for other nav items, check if href is in pathname.
        const isActive =
          localizedHref.length === 3
            ? localizedHref === pathname
            : pathname.includes(nav.href);
        const navVariant = isActive ? "default" : "ghost";

        if (nav.children) {
          return (
            <Collapsible key={nav.href}>
              <CollapsibleTrigger
                className={cn(
                  buttonVariants({ variant: navVariant }),
                  "w-full items-center justify-between gap-2 transition-all [&[data-state=open]>svg:last-child]:rotate-180"
                )}
              >
                <div className="flex items-center gap-2">
                  {isRoot ? (
                    <nav.icon className="size-4" />
                  ) : (
                    <DotIcon className="size-4" />
                  )}
                  {nav.title}
                </div>
                <div className="flex items-center gap-2">
                  {nav.label && (
                    <Badge variant="secondary" className="ms-auto">
                      {nav.label}
                    </Badge>
                  )}
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ms-2 overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <Nav
                  navs={nav.children as NavType[]}
                  dir={dir}
                  isRoot={false}
                />
              </CollapsibleContent>
            </Collapsible>
          );
        }

        return (
          <Link
            key={nav.href}
            href={localizedHref}
            className={cn(
              buttonVariants({ variant: navVariant }),
              "w-full justify-start gap-2"
            )}
          >
            {isRoot ? (
              <nav.icon className="size-4" />
            ) : (
              <DotIcon className="size-4" />
            )}
            {nav.title}
            {nav.label && (
              <Badge variant="secondary" className="ms-auto">
                {nav.label}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
