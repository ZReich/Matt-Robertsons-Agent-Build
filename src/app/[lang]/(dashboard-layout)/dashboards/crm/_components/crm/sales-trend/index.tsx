import { salesTrendData } from "../../../_data/sales-trend";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { SalesTrendChart } from "./sales-trend-chart";

export function SalesTrend() {
  return (
    <DashboardCard
      title="Sales Trend"
      period={salesTrendData.period}
      className="col-span-full md:col-span-3"
    >
      <SalesTrendChart data={salesTrendData} />
    </DashboardCard>
  );
}
