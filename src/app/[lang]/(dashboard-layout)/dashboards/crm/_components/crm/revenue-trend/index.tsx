import { revenueTrendData } from "../../../_data/revenue-trend";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { RevenueTrendChart } from "./revenue-trend-chart";
import { RevenueTrendTotal } from "./revenue-trend-total";

export function RevenueTrend() {
  return (
    <DashboardCard title="Revenue Trend" period={revenueTrendData.period}>
      <div className="space-y-4">
        <RevenueTrendTotal data={revenueTrendData.summary} />
        <RevenueTrendChart data={revenueTrendData.revenueTrends} />
      </div>
    </DashboardCard>
  );
}
