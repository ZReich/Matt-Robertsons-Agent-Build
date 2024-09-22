"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

import { cn } from "@/lib/utils";

import type { OverviewType } from ".";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function TotalProfit({ overviewData }: { overviewData: OverviewType }) {
  const isPositiveGrowing = overviewData.total_profit.growth_percentage >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Total Profit</CardTitle>
        <CardDescription>Last Year</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xl font-bold">
          ${overviewData.total_profit.last_year.toLocaleString()}
        </p>
        <div className="flex items-center gap-1">
          <Badge
            variant={isPositiveGrowing ? "default" : "destructive"}
            className={cn(
              isPositiveGrowing && "bg-green-500 hover:bg-green-600"
            )}
          >
            {isPositiveGrowing && "+"}
            {overviewData.total_profit.growth_percentage}%
          </Badge>
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
