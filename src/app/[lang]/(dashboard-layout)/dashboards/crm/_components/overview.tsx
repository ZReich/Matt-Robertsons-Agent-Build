import { BadgePercent, HandCoins, Users } from "lucide-react";

import { overviewData } from "../_data/overview";

import { OverviewCard } from "@/components/overview-card";

export function Overview() {
  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
      <OverviewCard
        data={overviewData.totalSales}
        title="Total Sales"
        description="Last month"
        icon={BadgePercent}
        formatStyle="currency"
      />
      <OverviewCard
        data={overviewData.totalProfit}
        title="Total Profit"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
      <OverviewCard
        data={overviewData.revenueGrowth}
        title="Revenue Growth"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
      <OverviewCard
        data={overviewData.newCustomers}
        title="New Customers"
        description="Last month"
        icon={Users}
      />
    </div>
  );
}
