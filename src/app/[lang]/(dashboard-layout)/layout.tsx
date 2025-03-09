import type { LocaleType } from "@/types"

import { getDictionary } from "@/lib/get-dictionary"

import { Layout } from "@/components/layout"

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { lang: LocaleType }
}) {
  const dictionary = await getDictionary(params.lang)

  return <Layout dictionary={dictionary}>{children}</Layout>
}
