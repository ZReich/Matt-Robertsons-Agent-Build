"use client";

import { XAxis, CartesianGrid, Area, AreaChart } from "recharts";

import type { SalesPipelineType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function SalesPipelineChart({
  data,
}: {
  data: SalesPipelineType["monthly"];
}) {
  return (
    <ChartContainer
      config={{}}
      className="aspect-auto h-[325px] w-full"
    >
      <AreaChart
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
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Area
          dataKey="lead"
          type="natural"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.4}
          stroke="hsl(var(--chart-1))"
        />
        <Area
          dataKey="proposal"
          type="natural"
          fill="hsl(var(--chart-2))"
          fillOpacity={0.5}
          stroke="hsl(var(--chart-2))"
        />
        <Area
          dataKey="negotiation"
          type="natural"
          fill="hsl(var(--chart-3))"
          fillOpacity={0.6}
          stroke="hsl(var(--chart-3))"
        />
        <Area
          dataKey="closed"
          type="natural"
          fill="hsl(var(--chart-4))"
          fillOpacity={0.7}
          stroke="hsl(var(--chart-4))"
        />
      </AreaChart>
    </ChartContainer>
  );
}
