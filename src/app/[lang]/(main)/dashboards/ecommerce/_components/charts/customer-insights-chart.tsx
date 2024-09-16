"use client";

import * as React from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import type { CustomerInsightsType } from "../customer-insights";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function CustomerInsightsChart({
  data,
}: {
  data: CustomerInsightsType;
}) {
  return (
    <ChartContainer config={chartConfig} className="mx-auto max-h-[250px]">
      <RadarChart data={data}>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator />}
        />
        <PolarAngleAxis dataKey="category" />
        <PolarGrid />
        <Radar dataKey="value" fill="hsl(var(--chart-3))" fillOpacity={0.6} />
      </RadarChart>
    </ChartContainer>
  );
}
