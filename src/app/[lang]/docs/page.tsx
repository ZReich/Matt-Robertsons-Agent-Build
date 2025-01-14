import { redirect } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { LocaleType } from "@/types";

export default function DocsPage({ params }: { params: { lang: LocaleType } }) {
  // Redirect to the localized inbox page
  redirect(ensureLocalizedPathname("/docs/overview/introduction", params.lang));
}
