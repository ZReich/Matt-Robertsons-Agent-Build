"use client";

import { CartesianGrid, Area, AreaChart, XAxis } from "recharts";

import { formatPercent } from "@/lib/utils";

import type { OverviewType } from "../../../../types";
import type {
  ChartConfig,
  ChartTooltipContentProps,
} from "@/components/ui/chart";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function ModifiedChartTooltipContent(props: ChartTooltipContentProps) {
  if (!props.payload || props.payload.length === 0) return null;

  return (
    <ChartTooltipContent
      {...props}
      payload={props.payload.map((item) => ({
        ...item,
        value: formatPercent(Number(item.value)),
      }))}
    />
  );
}

const chartConfig = {
  value: {
    label: "Rate",
  },
} satisfies ChartConfig;

export function ConversionRateChart({
  data,
}: {
  data: OverviewType["conversionRate"]["perMonth"];
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
        <XAxis dataKey="month" hide />
        <ChartTooltip
          cursor={false}
          content={<ModifiedChartTooltipContent />}
        />
        <Area
          dataKey="value"
          type="step"
          fill="hsl(var(--chart-4))"
          stroke="hsl(var(--chart-4))"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
