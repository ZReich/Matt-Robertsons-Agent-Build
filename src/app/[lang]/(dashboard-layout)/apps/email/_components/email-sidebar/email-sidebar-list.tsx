"use client";

import { useParams } from "next/navigation";

import { formatUnreadCount } from "@/lib/utils";

import type { LocaleType } from "@/configs/i18n";
import type { EmailSidebarLabel } from "../../types";

import { EmailSidebarItem } from "./email-sidebar-item";

export function EmailSidebarList({ data }: { data: EmailSidebarLabel[] }) {
  const params = useParams();

  const locale = params.lang as LocaleType;
  const segmentParam = params.segment;

  return (
    <ul className="p-3 pt-0">
      <nav className="space-y-1.5">
        {data.map((item) => {
          const unreadCount = formatUnreadCount(item.unreadCount);

          return (
            <EmailSidebarItem
              key={item.label}
              item={item}
              unreadCount={unreadCount}
              segmentParam={segmentParam}
              locale={locale}
            />
          );
        })}
      </nav>
    </ul>
  );
}
