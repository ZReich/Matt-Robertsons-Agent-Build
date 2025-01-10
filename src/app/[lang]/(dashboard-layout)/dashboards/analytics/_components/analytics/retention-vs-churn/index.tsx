import { retentionVsChurnData } from "../../../_data/retention-vs-churn";

import { RetentionVsChurnChart } from "./retention-vs-churn-chart";
import { DashboardCard } from "@/components/dashboards/dashboard-card";

export async function RetentionVsChurn() {
  return (
    <DashboardCard
      title="Retention vs Churn"
      period={retentionVsChurnData.period}
    >
      <RetentionVsChurnChart data={retentionVsChurnData.summary} />
    </DashboardCard>
  );
}
