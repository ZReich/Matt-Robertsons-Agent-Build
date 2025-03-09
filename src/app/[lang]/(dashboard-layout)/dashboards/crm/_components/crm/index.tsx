import { ActiveProjects } from "./active-projects"
import { ActivityTimeline } from "./activity-timeline"
import { CustomerSatisfaction } from "./customer-satisfaction"
import { LeadSources } from "./lead-sources"
import { Overview } from "./overview"
import { RevenueTrend } from "./revenue-trend"
import { SalesByCountry } from "./sales-by-country"
import { SalesTrend } from "./sales-trend"
import { TopSalesRepresentatives } from "./top-sales-representatives"

export function CRM() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <div className="col-span-full grid gap-4 md:grid-cols-4">
        <SalesTrend />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
          <RevenueTrend />
          <LeadSources />
        </div>
      </div>
      <ActiveProjects />
      <ActivityTimeline />
      <SalesByCountry />
      <TopSalesRepresentatives />
      <CustomerSatisfaction />
    </section>
  )
}
