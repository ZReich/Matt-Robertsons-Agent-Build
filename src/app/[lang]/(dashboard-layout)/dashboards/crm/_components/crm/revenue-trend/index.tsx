import { revenueTrendData } from "../../../_data/revenue-trend";

import { RevenueTrendChart } from "./revenue-trend-chart";
import { RevenueTrendTotal } from "./revenue-trend-total";
import { Card } from "@/components/ui/card";

export function RevenueTrend() {
  return (
    <Card className="p-6 h-fit">
      <h3 className="sr-only">Revenue Trend</h3>
      <div className="space-y-4">
        <RevenueTrendTotal data={revenueTrendData.summary} />
        <RevenueTrendChart data={revenueTrendData.revenueTrends} />
      </div>
    </Card>
  );
}
