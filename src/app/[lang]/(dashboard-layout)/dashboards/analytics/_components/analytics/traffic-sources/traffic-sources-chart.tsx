"use client";

import { RadialBar, RadialBarChart } from "recharts";

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

export function TrafficSourcesChart({
  data,
}: {
  data: TrafficSourcesType["sources"];
}) {
  const { settings } = useSettings();

  const radius = remToPx(settings.radius) - 2;

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-square h-[15.15rem] mx-auto"
    >
      <RadialBarChart data={data} innerRadius={30} outerRadius={110}>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <RadialBar dataKey="visitors" background cornerRadius={radius} />
      </RadialBarChart>
    </ChartContainer>
  );
}
