import { EllipsisVertical } from "lucide-react";

import { revenueTrendData } from "../../_data/revenue-trend";

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
import { RevenueTrendChart } from "./revenue-trend-chart";
import { RevenueTrendTotal } from "./revenue-trend-total";

export function RevenueTrend() {
  return (
    <article>
      <Card>
        <CardHeader className="flex-row justify-between items-start space-y-0">
          <div>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>2024</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions">
              <EllipsisVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-4">
          <RevenueTrendTotal data={revenueTrendData.summary} />
          <RevenueTrendChart data={revenueTrendData.monthly} />
        </CardContent>
      </Card>
    </article>
  );
}
