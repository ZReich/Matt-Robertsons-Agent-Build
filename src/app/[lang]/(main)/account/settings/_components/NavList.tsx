"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Locale } from "@/configs/i18n";
import { getLocalizedPathname } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Link {
  href: string;
  title: string;
}

const links: Link[] = [
  {
    href: "/account/settings",
    title: "General",
  },
  {
    href: "/account/settings/security",
    title: "Security",
  },
  {
    href: "/account/settings/plan-and-billing",
    title: "Plan & Billing",
  },
  {
    href: "/account/settings/notifications",
    title: "Notifications",
  },
];

export default function NavList({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground md:flex-col">
      {links.map((link) => {
        const localizedPathname = getLocalizedPathname(link.href, locale);

        return (
          <Link
            key={link.title}
            href={localizedPathname}
            className={cn(
              pathname === localizedPathname && "font-semibold text-primary"
            )}
          >
            {link.title}
          </Link>
        );
      })}
    </nav>
  );
}
