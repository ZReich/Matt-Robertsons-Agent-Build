import { trafficSourcesData } from "../../_data/traffic-sources";

import { DashboardCard } from "@/components/dashboard-card";
import { TrafficSourcesChart } from "./traffic-sources-chart";

export async function TrafficSources() {
  return (
    <DashboardCard title="Traffic Sources" period="Last month">
      <TrafficSourcesChart data={trafficSourcesData} />
    </DashboardCard>
  );
}
