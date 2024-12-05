"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronDown, Circle } from "lucide-react";

import { cn } from "@/lib/utils";
import { ensureLocalizedPathname } from "@/lib/i18n";

import type { NavType } from "@/data/navigation";
import type { DirectionType } from "@/types";
import type { LocaleType } from "@/configs/i18n";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DynamicIcon } from "@/components/dynamic-icon";

interface NavProps {
  navs: NavType[];
  direction: DirectionType;
  isRoot?: boolean;
  setIsMobileSidebarNavOpen?: (val: boolean) => void;
}

export function Nav({
  navs,
  direction,
  isRoot = true,
  setIsMobileSidebarNavOpen,
}: NavProps) {
  const pathname = usePathname();
  const params = useParams();

  const locale = params.lang as LocaleType;

  return (
    <ul className="grid gap-1" dir={direction}>
      {navs.map((nav) => {
        const isActive = pathname.includes(nav.href);

        if (nav.children) {
          return (
            <li key={nav.href}>
              <Collapsible>
                <CollapsibleTrigger
                  className={cn(
                    buttonVariants({ variant: isActive ? "default" : "ghost" }),
                    "w-full items-center justify-between gap-2 transition-all [&[data-state=open]>svg:last-child]:rotate-180"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isRoot ? (
                      <DynamicIcon
                        name={nav.iconName}
                        className="size-4"
                        aria-hidden
                      />
                    ) : (
                      <Circle className="size-2" aria-hidden />
                    )}
                    <span>{nav.name}</span>
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
                    direction={direction}
                    isRoot={false}
                  />
                </CollapsibleContent>
              </Collapsible>
            </li>
          );
        }

        return (
          <li key={nav.name}>
            <Link
              href={ensureLocalizedPathname(nav.href, locale)}
              className={cn(
                buttonVariants({ variant: isActive ? "default" : "ghost" }),
                "w-full justify-start gap-2"
              )}
              onClick={() => setIsMobileSidebarNavOpen?.(false)}
              aria-current={isActive ? "page" : undefined}
            >
              {isRoot ? (
                <DynamicIcon
                  name={nav.iconName}
                  className="size-4"
                  aria-hidden
                />
              ) : (
                <Circle className="size-2" aria-hidden />
              )}
              <span>{nav.name}</span>
              {nav.label && (
                <Badge variant="secondary" className="ms-auto">
                  {nav.label}
                </Badge>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
