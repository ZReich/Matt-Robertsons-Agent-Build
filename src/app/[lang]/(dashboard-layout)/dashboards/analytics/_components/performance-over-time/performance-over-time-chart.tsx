"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { PerformanceOverTimeType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function PerformanceOverTimeChart({
  data,
}: {
  data: PerformanceOverTimeType["performance"];
}) {
  return (
    <ChartContainer config={{}} className="w-full md:h-[288px]">
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
        <YAxis yAxisId="left" hide />
        <YAxis yAxisId="right" orientation="right" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Line
          dataKey="visitors"
          yAxisId="left"
          type="monotone"
          stroke="hsl(var(--chart-3))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          dataKey="conversions"
          yAxisId="right"
          type="monotone"
          stroke="hsl(var(--chart-5))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
