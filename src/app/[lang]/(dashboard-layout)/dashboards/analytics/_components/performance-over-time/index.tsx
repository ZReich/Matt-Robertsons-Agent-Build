import { performanceOverTimeData } from "../../_data/performance-over-time";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceOverTimeSummary } from "./performance-over-time-summary";
import { PerformanceOverTimeChart } from "./performance-over-time-chart";

export async function PerformanceOverTime() {
  return (
    <article>
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PerformanceOverTimeSummary data={performanceOverTimeData.summary} />
          <PerformanceOverTimeChart data={performanceOverTimeData.monthly} />
        </CardContent>
      </Card>
    </article>
  );
}
