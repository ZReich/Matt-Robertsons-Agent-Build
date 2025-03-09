import type { Metadata } from "next"

import { CRM } from "./_components/crm"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "CRM",
}

export default function CRMPage() {
  return <CRM />
}
