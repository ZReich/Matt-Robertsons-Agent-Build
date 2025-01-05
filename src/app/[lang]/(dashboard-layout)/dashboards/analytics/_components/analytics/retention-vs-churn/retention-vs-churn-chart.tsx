"use client";

import * as React from "react";
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import type { RetentionVsChurnType } from "../../../types";
import type { ChartConfig } from "@/components/ui/chart";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  retention: {
    label: "Retention",
    color: "hsl(var(--chart-1))",
  },
  churn: {
    label: "Churn",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function RetentionVsChurnChart({
  data,
}: {
  data: RetentionVsChurnType["summary"];
}) {
  return (
    <div className="aspect-video h-[80px] mx-auto">
      <ChartContainer
        config={chartConfig}
        className="aspect-square w-full max-w-[250px]"
      >
        <RadialBarChart
          data={[data]}
          endAngle={180}
          innerRadius={60}
          outerRadius={100}
        >
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) - 16}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {data.total.toLocaleString()}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 4}
                        className="fill-muted-foreground"
                      >
                        Total
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
          <RadialBar
            dataKey="retention"
            stackId="a"
            cornerRadius={5}
            fill="var(--color-retention)"
            className="stroke-transparent stroke-2"
          />
          <RadialBar
            dataKey="churn"
            fill="var(--color-churn)"
            stackId="a"
            cornerRadius={5}
            className="stroke-transparent stroke-2"
          />
        </RadialBarChart>
      </ChartContainer>
    </div>
  );
}
