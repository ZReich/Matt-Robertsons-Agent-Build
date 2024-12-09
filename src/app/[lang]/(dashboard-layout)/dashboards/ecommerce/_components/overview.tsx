import { BadgePercent, HandCoins, ShoppingBag } from "lucide-react";

import { overviewData } from "../_data/overview";

import { DashboardOverviewCard } from "@/components/dashboard-card";

export async function Overview() {
  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
      <DashboardOverviewCard
        data={overviewData.totalSales}
        title="Total Sales"
        period="Last month"
        icon={BadgePercent}
        formatStyle="currency"
      />
      <DashboardOverviewCard
        data={overviewData.revenueSummary}
        title="Revenue Summary"
        period="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
      <DashboardOverviewCard
        data={overviewData.numberOfOrders}
        title="Number of Orders"
        period="Last month"
        icon={ShoppingBag}
      />
      <DashboardOverviewCard
        data={overviewData.averageOrderValue}
        title="Avg. Order Value"
        period="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
    </div>
  );
}
