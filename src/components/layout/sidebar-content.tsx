"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";

import { i18n } from "@/configs/i18n";

import { groupNavs } from "@/data/navigation";

import type { LocaleType } from "@/configs/i18n";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Nav } from "@/components/layout/nav";

import Logo from "@/app/icon.svg";

export function SidebarContent({
  setIsMobileSidebarNavOpen,
}: {
  setIsMobileSidebarNavOpen?: (val: boolean) => void;
}) {
  const params = useParams();
  const locale = params.lang as LocaleType;

  const direction = i18n.langDirection[locale];

  return (
    <>
      <Link
        href={ensureLocalizedPathname("/", locale)}
        className="flex text-foreground font-black hover:text-primary/90"
        onClick={() => setIsMobileSidebarNavOpen?.(false)}
      >
        <Logo className="size-6" aira-hidden="true" />
        Shadboard
      </Link>
      <ScrollArea className="h-full -mx-5 p-2.5" dir={direction}>
        {groupNavs.map((group, index) => (
          <div className="py-2" key={index}>
            {group.title && (
              <h4 className="mx-4 mb-1 text-muted-foreground text-sm">
                {group.title}
              </h4>
            )}
            <Nav
              navs={group.navs}
              direction={direction}
              setIsMobileSidebarNavOpen={setIsMobileSidebarNavOpen}
            />
          </div>
        ))}
      </ScrollArea>
    </>
  );
}
