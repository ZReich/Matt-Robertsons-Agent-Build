import { BadgePercent, HandCoins, ShoppingBag } from "lucide-react";

import { overviewData } from "../_data/overview";

import { OverviewCard } from "@/components/OverviewCard";

export async function Overview() {
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
        data={overviewData.revenueSummary}
        title="Revenue Summary"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
      <OverviewCard
        data={overviewData.numberOfOrders}
        title="Number of Orders"
        description="Last month"
        icon={ShoppingBag}
      />
      <OverviewCard
        data={overviewData.averageOrderValue}
        title="Avg. Order Value"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
    </div>
  );
}
