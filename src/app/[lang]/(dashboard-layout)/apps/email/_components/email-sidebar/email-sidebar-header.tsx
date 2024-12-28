"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/configs/i18n";

import { Button } from "@/components/ui/button";

export function EmailSidebarHeader() {
  const params = useParams();

  const locale = params.lang as LocaleType;

  return (
    <div className="p-3">
      <Button className="w-full" size="lg" asChild>
        <Link href={ensureLocalizedPathname("/apps/email/compose", locale)}>
          Compose
        </Link>
      </Button>
    </div>
  );
}
