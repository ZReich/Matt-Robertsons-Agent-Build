import { z } from "zod";

import { TotalSales } from "./total-sales";
import { TotalProfit } from "./total-profit";
import { RevenueGrowth } from "./revenue_growth";
import { NewCustomers } from "./new-customers";

const OverviewSchema = z.object({
  total_sales: z.object({
    current_year: z.number(),
    last_year: z.number(),
    growth_percentage: z.number(),
  }),
  total_profit: z.object({
    current_year: z.number(),
    last_year: z.number(),
    growth_percentage: z.number(),
  }),
  revenue_growth: z.object({
    current_period: z.number(),
  }),
  new_customers: z.object({
    current_period: z.number(),
  }),
});

export type OverviewType = z.infer<typeof OverviewSchema>;

export function Overview() {
  const overviewData: OverviewType = {
    total_sales: {
      current_year: 1234567,
      last_year: 1123456,
      growth_percentage: 9.9,
    },
    total_profit: {
      current_year: 345678,
      last_year: 345000,
      growth_percentage: -0.2,
    },
    revenue_growth: {
      current_period: 12.5,
    },
    new_customers: {
      current_period: 45,
    },
  };

  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
      <TotalSales overviewData={overviewData} />
      <TotalProfit overviewData={overviewData} />
      <RevenueGrowth overviewData={overviewData} />
      <NewCustomers overviewData={overviewData} />
    </div>
  );
}
