import { z } from "zod";
import { DollarSign, HandCoins, ShoppingBag, Wallet } from "lucide-react";

import { getOverviewData } from "../_actions/get-overview-data";

import { OverviewCard } from "@/components/OverviewCard";
import { SalesTrend } from "./sales-trend";

export const MetricSchema = z.object({
  value: z.number(),
  percentage_change: z.number(),
});

export const SalesTrendSchema = z.object({
  date: z.number().nonnegative(),
  sales: z.number().nonnegative(),
});

export const OverviewSchema = z.object({
  total_sales: MetricSchema,
  revenue_summary: MetricSchema,
  number_of_orders: MetricSchema,
  average_order_value: MetricSchema,
  sales_trend: z.array(SalesTrendSchema),
});

export type SalesTrendType = z.infer<typeof SalesTrendSchema>;
export type OverviewType = z.infer<typeof OverviewSchema>;

export async function Overview() {
  const overviewData: OverviewType = await getOverviewData();

  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
      <OverviewCard
        data={overviewData.total_sales}
        title="Total Sales"
        description="Last month"
        icon={DollarSign}
        formatStyle="currency"
      />
      <OverviewCard
        data={overviewData.revenue_summary}
        title="Revenue Summary"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
      <OverviewCard
        data={overviewData.number_of_orders}
        title="Number of Orders"
        description="Last month"
        icon={ShoppingBag}
      />
      <OverviewCard
        data={overviewData.average_order_value}
        title="Avg. Order Value"
        description="Last month"
        icon={Wallet}
        formatStyle="currency"
      />
      <SalesTrend />
    </div>
  );
}
