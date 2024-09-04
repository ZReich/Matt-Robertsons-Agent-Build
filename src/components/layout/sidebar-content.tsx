"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { getLocalizedPathname } from "@/lib/i18n";

import { i18n, Locale } from "@/configs/i18n";

import { groupNavs } from "@/data/navigation";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Nav } from "@/components/layout/nav";

import ShadboardIcon from "/public/images/logos/shadboard.svg";

export function SidebarContent() {
  const params = useParams();
  const locale = params.lang as Locale;

  const dir = i18n.langDirection[locale];

  return (
    <>
      <Link
        href={getLocalizedPathname("/", locale)}
        className="flex text-foreground font-black hover:text-primary/90"
      >
        <ShadboardIcon className="size-6" aira-hidden="true" />
        Shadboard
      </Link>
      <ScrollArea className="h-full -mx-5 px-2.5" dir={dir}>
        {groupNavs.map((group, index) => (
          <div className="py-2" key={index}>
            {group.title && (
              <h4 className="mx-4 mb-1 text-muted-foreground text-sm">
                {group.title}
              </h4>
            )}
            <Nav navs={group.navs} dir={dir} />
          </div>
        ))}
      </ScrollArea>
    </>
  );
}
