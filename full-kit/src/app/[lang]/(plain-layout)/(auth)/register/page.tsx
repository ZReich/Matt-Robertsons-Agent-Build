import type { Metadata } from "next"
import { LocaleType } from "@/types"

import { getDictionary } from "@/lib/get-dictionary"

import { Register } from "@/components/auth/register"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Register",
}

export default async function RegisterPage(props: {
  params: Promise<{ lang: LocaleType }>
}) {
  const params = await props.params
  const dictionary = await getDictionary(params.lang)

  return <Register dictionary={dictionary} />
}
