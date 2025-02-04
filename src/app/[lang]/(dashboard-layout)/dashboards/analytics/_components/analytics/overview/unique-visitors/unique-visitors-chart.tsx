"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import type { OverviewType } from "../../../../types";
import type { ChartConfig } from "@/components/ui/chart";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  value: {
    label: "Visitors",
  },
} satisfies ChartConfig;

export function UniqueVisitorsChart({
  data,
}: {
  data: OverviewType["uniqueVisitors"]["perMonth"];
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="h-32 w-full rounded-md overflow-hidden"
    >
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{
          left: 0,
          right: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          hide
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          dataKey="value"
          type="natural"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.4}
          stroke="hsl(var(--chart-1))"
        />
      </AreaChart>
    </ChartContainer>
  );
}
