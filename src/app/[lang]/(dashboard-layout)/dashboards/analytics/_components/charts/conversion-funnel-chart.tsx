"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useSettings } from "@/hooks/use-settings";

import { chartConfig } from "@/configs/chart-config";

import { remToPx } from "@/lib/utils";

import type { ConversionFunnelType } from "../conversion-funnel";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function ConversionFunnelChart({
  data,
}: {
  data: ConversionFunnelType;
}) {
  const { settings } = useSettings();

  const conversionFunnelData = Object.entries(data).map(
    ([name, value], index) => ({
      name: name
        .replace(/_+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      value,
      fill: `hsl(var(--chart-${index + 1}))`,
    })
  );
  return (
    <ChartContainer config={chartConfig}>
      <BarChart
        accessibilityLayer
        data={conversionFunnelData}
        layout="vertical"
        margin={{
          left: 25,
        }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" dataKey="value" hide />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="value" radius={remToPx(settings.radius) - 2} />
      </BarChart>
    </ChartContainer>
  );
}
