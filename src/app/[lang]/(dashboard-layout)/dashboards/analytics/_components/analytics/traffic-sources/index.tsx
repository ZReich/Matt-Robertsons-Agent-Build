import { trafficSourcesData } from "../../../_data/traffic-sources";

import { DashboardCard, DashboardCardActionsDropdown } from "@/components/dashboards/dashboard-card";
import { TrafficSourcesChart } from "./traffic-sources-chart";
import { TrafficSourcesTable } from "./traffic-sources-table";

export async function TrafficSources() {
  return (
    <DashboardCard
      title="Traffic Sources"
      period={trafficSourcesData.period}
      action={<DashboardCardActionsDropdown />}
      contentClassName="grid gap-6"
    >
      <TrafficSourcesChart data={trafficSourcesData.sources} />
      <TrafficSourcesTable data={trafficSourcesData.sources} />
    </DashboardCard>
  );
}
