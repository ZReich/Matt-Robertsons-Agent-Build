import type { Metadata } from "next"

import { Register } from "@/components/auth/register"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Register",
}

export default function RegisterPage() {
  return <Register />
}
