import { leadSourcesData } from "../../_data/lead-sources";

import { DashboardCard } from "@/components/dashboard-card";
import { LeadSourcesChart } from "./lead-sources-chart";

export function LeadSources() {
  return (
    <DashboardCard title="Lead Sources" period="Last month">
      <LeadSourcesChart data={leadSourcesData} />
    </DashboardCard>
  );
}
