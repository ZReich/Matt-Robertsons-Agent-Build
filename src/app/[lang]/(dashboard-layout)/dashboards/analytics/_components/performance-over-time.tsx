import { performanceOverTimeData } from "../_data/performance-over-time";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceOverTimeChart } from "./charts/performance-over-time-chart";

export async function PerformanceOverTime() {
  return (
    <article>
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceOverTimeChart data={performanceOverTimeData} />
        </CardContent>
      </Card>
    </article>
  );
}
