import { revenueTrendData } from "../_data/revenue-trend"

import { Card } from "@/components/ui/card"
import { RevenueTrendChart } from "./revenue-trend-chart"
import { RevenueTrendSummary } from "./revenue-trend-summary"

export function RevenueTrend() {
  return (
    <Card className="h-fit p-6">
      <div className="space-y-4">
        <RevenueTrendSummary data={revenueTrendData.summary} />
        <RevenueTrendChart data={revenueTrendData.revenueTrends} />
      </div>
    </Card>
  )
}
