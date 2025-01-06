import { redirect } from "next/navigation";

import { ensureLocalizedPathname } from "@/lib/i18n";

import type { Metadata } from "next";
import type { LocaleType } from "@/types";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Email",
};

export default function EmailPage({
  params,
}: {
  params: { lang: LocaleType };
}) {
  // Redirect to the localized inbox page
  redirect(ensureLocalizedPathname("/apps/email/inbox", params.lang));
}
