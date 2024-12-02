"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronDown, Circle } from "lucide-react";

import type { NavType } from "@/data/navigation";
import type { DirectionType } from "@/types";
import type { LocaleType } from "@/configs/i18n";

import { cn } from "@/lib/utils";
import { ensureLocalizedPathname } from "@/lib/i18n";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavProps {
  navs: NavType[];
  dir: DirectionType;
  isRoot?: boolean;
  setIsMobileSidebarNavOpen?: (val: boolean) => void;
}

export function Nav({
  navs,
  dir,
  isRoot = true,
  setIsMobileSidebarNavOpen,
}: NavProps) {
  const pathname = usePathname();
  const params = useParams();

  const locale = params.lang as LocaleType;

  return (
    <nav className="grid gap-1" dir={dir}>
      {navs.map((nav) => {
        const isActive = pathname.includes(nav.href);

        if (nav.children) {
          return (
            <Collapsible key={nav.href}>
              <CollapsibleTrigger
                className={cn(
                  buttonVariants({ variant: isActive ? "default" : "ghost" }),
                  "w-full items-center justify-between gap-2 transition-all [&[data-state=open]>svg:last-child]:rotate-180"
                )}
              >
                <div className="flex items-center gap-2">
                  {isRoot ? (
                    <nav.icon className="size-4" />
                  ) : (
                    <Circle className="size-2" />
                  )}
                  {nav.title}
                </div>
                <div className="flex items-center gap-2">
                  {nav.label && (
                    <Badge variant="secondary" className="ms-auto">
                      {nav.label}
                    </Badge>
                  )}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
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
            href={ensureLocalizedPathname(nav.href, locale)}
            className={cn(
              buttonVariants({ variant: isActive ? "default" : "ghost" }),
              "w-full justify-start gap-2"
            )}
            onClick={() => setIsMobileSidebarNavOpen?.(false)}
          >
            {isRoot ? (
              <nav.icon className="size-4" />
            ) : (
              <Circle className="size-2" />
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
