"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

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
      className="aspect-video w-full rounded-md overflow-hidden"
    >
      <LineChart
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
        <Line
          dataKey="value"
          type="step"
          stroke="hsl(var(--chart-4))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
