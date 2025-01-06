import { getDictionary } from "@/lib/getDictionary";

import type { LocaleType } from "@/types";

import { Layout } from "@/components/layout";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: LocaleType };
}) {
  const dictionary = await getDictionary(params.lang);

  return <Layout dictionary={dictionary}>{children}</Layout>;
}
