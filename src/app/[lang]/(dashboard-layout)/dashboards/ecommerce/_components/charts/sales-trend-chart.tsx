"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useSettings } from "@/hooks/use-settings";

import { chartConfig } from "@/configs/chart-config";

import { remToPx } from "@/lib/utils";

import { SalesTrendType } from "../overview";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { format } from "date-fns";

export function SalesTrendChart({ data }: { data: SalesTrendType[] }) {
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
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => format(value, "dd/MM/yyy")}
        />
        <YAxis tickLine={false} tickMargin={10} axisLine={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dashed" />}
        />
        <Bar
          dataKey="sales"
          fill="hsl(var(--chart-1))"
          radius={remToPx(settings.radius) - 2}
        />
      </BarChart>
    </ChartContainer>
  );
}
