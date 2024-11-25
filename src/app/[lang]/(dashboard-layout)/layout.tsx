import { getDictionary } from "@/lib/getDictionary";

import type { LocaleType } from "@/configs/i18n";

import Layout from "@/components/layout";

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { lang: LocaleType };
}>) {
  const dictionary = await getDictionary(params.lang);

  return <Layout dictionary={dictionary}>{children}</Layout>;
}
