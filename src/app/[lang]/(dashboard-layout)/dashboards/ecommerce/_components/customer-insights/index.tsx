import { customerInsightsData } from "../../_data/customer-insights";

import { DashboardCard } from "@/components/dashboard-card";
import { CustomerInsightList } from "./customer-insight-list";

export async function CustomerInsights() {
  return (
    <DashboardCard
      title="Top Products"
      period="Last month"
      className="col-span-full"
    >
      <CustomerInsightList data={customerInsightsData} />
    </DashboardCard>
  );
}
