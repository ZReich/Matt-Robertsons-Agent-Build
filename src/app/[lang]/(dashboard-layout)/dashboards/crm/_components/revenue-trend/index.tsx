import { revenueTrendData } from "../../_data/revenue-trend";

import { DashboardCard } from "@/components/dashboard-card";
import { RevenueTrendChart } from "./revenue-trend-chart";
import { RevenueTrendTotal } from "./revenue-trend-total";

export function RevenueTrend() {
  return (
    <DashboardCard title="Revenue Trend" period="2024">
      <div className="space-y-4">
        <RevenueTrendTotal data={revenueTrendData.summary} />
        <RevenueTrendChart data={revenueTrendData.monthly} />
      </div>
    </DashboardCard>
  );
}
