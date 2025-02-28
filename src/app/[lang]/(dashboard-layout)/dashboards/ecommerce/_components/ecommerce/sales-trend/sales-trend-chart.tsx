"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  camelCaseToTitleCase,
  formatCurrency,
  formatDateShort,
  remToPx,
} from "@/lib/utils";

import type { SalesTrendType } from "../../../types";
import type { ChartTooltipContentProps } from "@/components/ui/chart";

import { useSettings } from "@/hooks/use-settings";
import { useIsRtl } from "@/hooks/use-is-rtl";

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
        name: camelCaseToTitleCase(String(item.name)),
        value: formatCurrency(Number(item.value)),
      }))}
    />
  );
}

export function SalesTrendChart({
  data,
}: {
  data: SalesTrendType["salesTrends"];
}) {
  const { settings } = useSettings();
  const isRtl = useIsRtl();

  const radius = remToPx(settings.radius);

  return (
    <ChartContainer config={{}} className="w-full md:h-[200px]">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <ChartTooltip
          cursor={false}
          content={<ModifiedChartTooltipContent hideIndicator hideLabel />}
        />
        <XAxis
          reversed={isRtl}
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={(value) => formatDateShort(value)}
        />
        <Bar dataKey="sales" fill="hsl(var(--chart-4))" radius={radius} />
      </BarChart>
    </ChartContainer>
  );
}
