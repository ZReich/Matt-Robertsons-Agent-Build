"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import type { OverviewType } from ".";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RevenueGrowth({
  overviewData,
}: {
  overviewData: OverviewType;
}) {
  const isPositiveGrowing = overviewData.revenue_growth.current_period > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="w-max">Revenue Growth</CardTitle>
        <CardDescription>Current Period</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-green-500">
            {isPositiveGrowing && "+"}
            {overviewData.revenue_growth.current_period}%
          </span>
          {isPositiveGrowing ? (
            <TrendingUp className="size-4 text-green-500" />
          ) : (
            <TrendingDown className="size-4 text-destructive" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
