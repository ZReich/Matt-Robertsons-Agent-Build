import { redirect } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/configs/i18n";

export default function EmailPage({ params }: { params: { lang: LocaleType } }) {
  redirect(ensureLocalizedPathname("/apps/email/inbox", params.lang));
}
