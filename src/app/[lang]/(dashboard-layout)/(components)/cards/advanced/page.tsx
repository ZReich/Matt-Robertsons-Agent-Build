import type { Metadata } from "next"

import { EngagementByDevice } from "../../../dashboards/analytics/_components/analytics/engagement-by-device"
import { VisitorsByCountry } from "../../../dashboards/analytics/_components/analytics/visitors-by-country"
import { ActiveProjects } from "../../../dashboards/crm/_components/crm/active-projects"
import { ActivityTimeline } from "../../../dashboards/crm/_components/crm/activity-timeline"
import { CustomerSatisfaction } from "../../../dashboards/crm/_components/crm/customer-satisfaction"
import { TopSalesRepresentatives } from "../../../dashboards/crm/_components/crm/top-sales-representatives"
import { Invoices } from "../../../dashboards/ecommerce/_components/ecommerce/invoices"
import { TopProducts } from "../../../dashboards/ecommerce/_components/ecommerce/top-products"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Advanced Cards",
}

export default function AdvancedCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <ActiveProjects />
      <ActivityTimeline />
      <CustomerSatisfaction />
      <TopProducts />
      <TopSalesRepresentatives />
      <VisitorsByCountry />
      <EngagementByDevice />
      <Invoices />
    </section>
  )
}
