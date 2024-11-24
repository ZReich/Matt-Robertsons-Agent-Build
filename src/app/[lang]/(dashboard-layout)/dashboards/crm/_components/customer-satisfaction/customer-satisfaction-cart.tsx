"use client";

import {
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { ratingToPercentage, remToPx } from "@/lib/utils";

import type { CustomerSatisfactionType } from "../../types";

import { useSettings } from "@/hooks/use-settings";

import { ChartContainer } from "@/components/ui/chart";

const maxRating = 5;

export function CustomerSatisfactionChart({
  data,
}: {
  data: CustomerSatisfactionType["summary"];
}) {
  const { settings } = useSettings();

  return (
    <ChartContainer config={chartConfig} className="aspect-square h-[200px]">
      <RadialBarChart
        accessibilityLayer
        data={[data]}
        startAngle={0}
        endAngle={360}
        innerRadius={80}
        outerRadius={150}
      >
        <PolarAngleAxis
          type="number"
          domain={[0, maxRating]}
          angleAxisId={0}
          tick={false}
        />
        <RadialBar
          background
          dataKey="value"
          cornerRadius={remToPx(settings.radius)}
          fill="hsl(var(--primary))"
        />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-4xl font-bold"
                    >
                      {data.value} / 5
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 24}
                      className="fill-muted-foreground"
                    >
                      {ratingToPercentage(data.value, maxRating).toFixed(0)}%
                      Satisfied
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  );
}
