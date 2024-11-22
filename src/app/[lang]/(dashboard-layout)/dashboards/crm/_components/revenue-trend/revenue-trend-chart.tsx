"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import type { RevenueTrendType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function RevenueTrendChart({ data }: { data: RevenueTrendType[] }) {
  return (
    <ChartContainer config={chartConfig}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Line dataKey="value" type="natural" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
