import { EllipsisVertical } from "lucide-react";

import { salesTrendData } from "../_data/sales-trend";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SalesTrendChart } from "./charts/sales-trend-chart";
import { SalesTrendSummary } from "./sales-trend-summary";

export async function SalesTrend() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start">
          <div>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>Last week</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More options">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-4">
          <SalesTrendSummary data={salesTrendData.summary} />
          <SalesTrendChart data={salesTrendData.weekly} />
        </CardContent>
      </Card>
    </article>
  );
}
