"use client";

import { PieChart, Pie, Cell } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import type { LeadSourceType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function LeadSourcesChart({
  data,
}: {
  data: LeadSourceType["leadSources"];
}) {
  return (
    <ChartContainer config={chartConfig} className="w-full md:h-[245px]">
      <PieChart accessibilityLayer>
        <Pie
          data={data}
          labelLine={false}
          dataKey="percentage"
          nameKey="name"
          label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
        >
          {data.map((source) => (
            <Cell key={source.name} fill={source.fill} fontWeight={600} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent nameKey="source" />} />
      </PieChart>
    </ChartContainer>
  );
}
