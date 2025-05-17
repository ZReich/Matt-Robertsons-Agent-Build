import type { Metadata } from "next"
import { LocaleType } from "@/types"

import { getDictionary } from "@/lib/get-dictionary"

import { NewPassword } from "@/components/auth/new-passward"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "New Password",
}

export default async function NewPasswordPage(props: {
  params: Promise<{ lang: LocaleType }>
}) {
  const params = await props.params
  const dictionary = await getDictionary(params.lang)

  return <NewPassword dictionary={dictionary} />
}
