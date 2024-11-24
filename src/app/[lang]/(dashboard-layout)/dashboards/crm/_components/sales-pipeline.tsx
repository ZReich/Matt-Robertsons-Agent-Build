import { salesPipelineData } from "../_data/sales-pipeline";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesPipelineChart } from "./charts/sales-pipeline-chart";

export function SalesPipeline() {
  return (
    <article>
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesPipelineChart data={salesPipelineData} />
        </CardContent>
      </Card>
    </article>
  );
}
