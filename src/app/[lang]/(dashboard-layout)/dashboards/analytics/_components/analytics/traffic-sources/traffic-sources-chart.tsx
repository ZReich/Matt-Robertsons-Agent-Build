"use client";

import * as React from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { remToPx } from "@/lib/utils";

import type { TrafficSourcesType } from "../../../types";
import type { ChartConfig } from "@/components/ui/chart";

import { useSettings } from "@/hooks/use-settings";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
} satisfies ChartConfig;

export function TrafficSourcesChart({ data }: { data: TrafficSourcesType }) {
  const { settings } = useSettings();

  return (
    <ChartContainer
      config={chartConfig}
      className="h-72 w-[calc(100vw-90px)] md:w-1/2"
    >
      <BarChart
        accessibilityLayer
        data={data.sources}
        layout="vertical"
        margin={{
          left: 0,
        }}
      >
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <XAxis dataKey="visitors" type="number" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar
          dataKey="visitors"
          layout="vertical"
          radius={remToPx(settings.radius) - 2}
        />
      </BarChart>
    </ChartContainer>
  );
}
