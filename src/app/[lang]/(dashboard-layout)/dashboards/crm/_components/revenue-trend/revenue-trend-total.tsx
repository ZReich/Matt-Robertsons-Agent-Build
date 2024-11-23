"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import type { RevenueTrendType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useSettings } from "@/hooks/use-settings";
import { cn, remToPx } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function RevenueTrendTotal({
  data,
}: {
  data: RevenueTrendType["summary"];
}) {
  const isPositiveChange = data.totalPercentageChange >= 0;

  return (
    <div className="flex justify-between items-end gap-x-2 bg-accent text-accent-foreground p-4 rounded-lg">
      <div>
        <h4 className="text-sm text-muted-foreground">Total Revenue</h4>
        <p className="text-3xl font-semibold">
          ${data.totalRevenue.toLocaleString()}
        </p>
      </div>
      <Badge
        variant="destructive"
        className={cn(
          "size-fit justify-center",
          isPositiveChange && "bg-success hover:bg-success/90"
        )}
        aria-label="Increase"
      >
        {isPositiveChange && <span>+</span>}
        <span>{data.totalPercentageChange * 100 + "%"}</span>
        <span className="ms-1" aria-hidden>
          {isPositiveChange ? (
            <TrendingUp className="size-4" />
          ) : (
            <TrendingDown className="size-4" />
          )}
        </span>
      </Badge>
    </div>
  );
}
