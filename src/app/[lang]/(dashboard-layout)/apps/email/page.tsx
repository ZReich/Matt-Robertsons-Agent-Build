import { redirect } from "next/navigation";

import { getLocalizedPathname } from "@/lib/i18n";

import type { Locale } from "@/configs/i18n";

export default function EmailPage({ params }: { params: { lang: Locale } }) {
  redirect(getLocalizedPathname("/apps/email/inbox", params.lang));
}
