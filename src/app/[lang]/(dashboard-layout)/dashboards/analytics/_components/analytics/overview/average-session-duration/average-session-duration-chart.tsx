"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { formatDuration, remToPx } from "@/lib/utils";

import { useSettings } from "@/hooks/use-settings";

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

function FormattedChartTooltipContent(props: ChartTooltipContentProps) {
  if (!props.payload || props.payload.length === 0) return null;

  return (
    <ChartTooltipContent
      {...props}
      payload={props.payload.map((item) => ({
        ...item,
        value: formatDuration(Number(item.value)),
      }))}
    />
  );
}

const chartConfig = {
  value: {
    label: "Duration",
  },
} satisfies ChartConfig;

export function AverageSessionDurationChart({
  data,
}: {
  data: OverviewType["averageSessionDuration"]["perMonth"];
}) {
  const { settings } = useSettings();

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-video w-full rounded-md overflow-hidden"
    >
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={<FormattedChartTooltipContent />}
        />
        <XAxis dataKey="month" hide />
        <Bar dataKey="value" radius={remToPx(settings.radius) - 2} />
      </BarChart>
    </ChartContainer>
  );
}
