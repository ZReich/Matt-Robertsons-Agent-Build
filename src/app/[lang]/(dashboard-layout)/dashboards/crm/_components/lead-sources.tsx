import { leadSourcesData } from "../_data/lead-sources"

import { DashboardCard } from "@/components/dashboards/dashboard-card"
import { LeadSourcesChart } from "./lead-sources-chart"

export function LeadSources() {
  return (
    <DashboardCard title="Lead Sources">
      <LeadSourcesChart
        data={{
          leads: leadSourcesData.leads,
          summary: leadSourcesData.summary,
        }}
      />
    </DashboardCard>
  )
}
