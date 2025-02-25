import { performanceOverTimeData } from "../../../_data/performance-over-time";

import { DashboardCardWithoutPeriod } from "@/components/dashboards/dashboard-card";
import { PerformanceOverTimeSummary } from "./performance-over-time-summary";
import { PerformanceOverTimeChart } from "./performance-over-time-chart";

export async function PerformanceOverTime() {
  return (
    <DashboardCardWithoutPeriod title="Performance over Time">
      <div className="space-y-6">
        <PerformanceOverTimeSummary data={performanceOverTimeData.summary} />
        <PerformanceOverTimeChart data={performanceOverTimeData.performance} />
      </div>
    </DashboardCardWithoutPeriod>
  );
}
