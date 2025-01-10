import { salesPipelineData } from "../../../_data/sales-pipeline";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { SalesPipelineChart } from "./sales-pipeline-chart";

export function SalesPipeline() {
  return (
    <DashboardCard title="Sales Pipeline" period={salesPipelineData.period}>
      <SalesPipelineChart data={salesPipelineData} />
    </DashboardCard>
  );
}
