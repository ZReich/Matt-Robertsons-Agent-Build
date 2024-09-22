import { z } from "zod";
import { Users, Ellipsis } from "lucide-react";

import { getOverviewData } from "../_actions/get-overview-data";

import type { OverviewType } from "./overview";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SalesTrendChart } from "./charts/sales-trend-chart";

export async function SalesTrend() {
  const { sales_trend: salesTrendData }: OverviewType = await getOverviewData();

  return (
    <Card className="col-span-2 md:col-span-4">
      <CardHeader className="relative pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Sales Trend
        </CardTitle>
        <CardDescription>Last month</CardDescription>
        <Ellipsis className="absolute top-4 end-6 size-4 hover:cursor-pointer" />
      </CardHeader>
      <CardContent>
        <SalesTrendChart data={salesTrendData} />
      </CardContent>
    </Card>
  );
}
