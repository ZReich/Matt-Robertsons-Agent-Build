"use client";

import { Users, UserPlus, Crown, UserCheck } from "lucide-react";

import type { CustomerInsightsType } from "../types";

import { CustomerInsightItem } from "./customer-insight-item";

export function CustomerInsightList({ data }: { data: CustomerInsightsType }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:justify-items-center ">
      <CustomerInsightItem
        title="Total Customers"
        value={data.totalCustomers}
        icon={Users}
        color="hsl(var(--chart-1))"
      />
      <CustomerInsightItem
        title="New Customers"
        value={data.newCustomers}
        icon={UserPlus}
        color="hsl(var(--chart-2))"
      />
      <CustomerInsightItem
        title="Returning Customers"
        value={data.returningCustomers}
        icon={UserCheck}
        color="hsl(var(--chart-3))"
      />
      <CustomerInsightItem
        title="VIP Customers"
        value={data.vipCustomers}
        icon={Crown}
        color="hsl(var(--chart-4))"
      />
    </ul>
  );
}
