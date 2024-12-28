"use client";

import Link from "next/link";

import { ensureLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";
import type { EmailSidebarLabel } from "../../types";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/dynamic-icon";

interface EmailSidebarItemProps {
  item: EmailSidebarLabel;
  unreadCount: number | string;
  segmentParam: string | string[];
  locale: LocaleType;
}

export function EmailSidebarItem({
  item,
  unreadCount,
  segmentParam,
  locale,
}: EmailSidebarItemProps) {
  return (
    <li>
      <Link
        href={ensureLocalizedPathname("/apps/email/" + item.param, locale)}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "w-full justify-start",
          segmentParam === item.param && "bg-accent" // Highlight the current email view
        )}
        aria-current={segmentParam === item.param ? "true" : undefined}
      >
        <DynamicIcon name={item.iconName} className="me-2 h-4 w-4" />
        {item.label}
        {/* Display the badge only if there is an unread count */}
        {!!unreadCount && <Badge className="ms-auto">{unreadCount}</Badge>}
      </Link>
    </li>
  );
}
