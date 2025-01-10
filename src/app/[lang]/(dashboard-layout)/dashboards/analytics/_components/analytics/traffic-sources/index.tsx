import { trafficSourcesData } from "../../../_data/traffic-sources";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { TrafficSourcesChart } from "./traffic-sources-chart";
import { TrafficSourcesSummary } from "./traffic-sources-summary";

export async function TrafficSources() {
  return (
    <DashboardCard
      title="Traffic Sources"
      period={trafficSourcesData.period}
      className="col-span-full"
    >
      <div className="flex flex-col justify-between items-center gap-6 md:flex-row">
        <TrafficSourcesChart data={trafficSourcesData} />
        <TrafficSourcesSummary data={trafficSourcesData} />
      </div>
    </DashboardCard>
  );
}
