import { salesPipelineData } from "../../../_data/sales-pipeline";

import { DashboardCardWithoutPeriod } from "@/components/dashboard-card";
import { SalesPipelineSummary } from "./sales-pipeline-summary";
import { SalesPipelineChart } from "./sales-pipeline-chart";

export function SalesPipeline() {
  return (
    <DashboardCardWithoutPeriod title="Sales Pipeline">
      <div className="flex flex-col justify-center items-center gap-6">
        <SalesPipelineSummary data={salesPipelineData.summary} />
        <SalesPipelineChart data={salesPipelineData.monthly} />
      </div>
    </DashboardCardWithoutPeriod>
  );
}
