import type { LocaleType } from "@/types"

import { getDictionary } from "@/lib/get-dictionary"

import { Layout } from "@/components/layout"

export default async function DashboardLayout(props: {
  children: React.ReactNode
  params: Promise<{ lang: LocaleType }>
}) {
  const params = await props.params

  const { children } = props

  const dictionary = await getDictionary(params.lang)

  return <Layout dictionary={dictionary}>{children}</Layout>
}
