import type { Metadata } from "next"
import { LocaleType } from "@/types"

import { getDictionary } from "@/lib/get-dictionary"

import { ForgotPassword } from "@/components/auth/forgot-password"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Forgot Password",
}

export default async function ForgotPasswordPage(props: {
  params: Promise<{ lang: LocaleType }>
}) {
  const params = await props.params
  const dictionary = await getDictionary(params.lang)

  return <ForgotPassword dictionary={dictionary} />
}
