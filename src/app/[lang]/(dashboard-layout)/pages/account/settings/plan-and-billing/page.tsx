import type { Metadata } from "next"

import { PlanAndBilling } from "./_components/plan-and-billing"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Plan and Billing Settings",
}

export default async function PlanAndBillingPage() {
  return <PlanAndBilling />
}
