import type { Metadata } from "next"

import { Analytics } from "./_components/analytics"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Analytics",
}

export default function AnalyticsPage() {
  return <Analytics />
}
