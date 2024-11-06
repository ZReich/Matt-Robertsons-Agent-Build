"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Locale } from "@/configs/i18n";
import { getLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { sidebarListItems } from "../[list]/page";

export function Sidebar() {
  const params = useParams();

  const locale = params.lang as Locale;
  const listParam = params.list;

  return (
    <div className="w-64 border-r p-4">
      <Button className="w-full bg-primary mb-4" size="lg">
        Compose
      </Button>
      <nav className="space-y-2">
        {sidebarListItems.map((item) => (
          <Link
            key={item.label}
            href={getLocalizedPathname("/apps/email/" + item.param, locale)}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "w-full justify-start",
              listParam === item.param && "bg-muted"
            )}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
            {item?.unreadCount && (
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs">
                {item.unreadCount}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
