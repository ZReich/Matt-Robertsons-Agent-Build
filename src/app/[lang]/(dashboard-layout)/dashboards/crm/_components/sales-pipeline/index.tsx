import { salesPipelineData } from "../../_data/sales-pipeline";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesPipelineSummary } from "./sales-pipeline-summary";
import { SalesPipelineChart } from "./sales-pipeline-chart";

export function SalesPipeline() {
  return (
    <article>
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center gap-6">
          <SalesPipelineSummary data={salesPipelineData.summary} />
          <SalesPipelineChart data={salesPipelineData.monthly} />
        </CardContent>
      </Card>
    </article>
  );
}
