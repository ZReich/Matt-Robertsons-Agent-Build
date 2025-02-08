"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useDirection } from "@radix-ui/react-direction";

import { remToPx } from "@/lib/utils";

import type { RevenueTrendType } from "../../../types";


import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useSettings } from "@/hooks/use-settings";

export function RevenueTrendChart({
  data,
}: {
  data: RevenueTrendType["revenueTrends"];
}) {
  const direction = useDirection();
  const { settings } = useSettings();

  const isRtl = direction === "rtl";

  return (
    <ChartContainer config={{}} className="aspect-auto h-40 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          reversed={isRtl}
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              hideLabel
              formatter={(value, name) => (
                <div className="w-full flex justify-between text-xs">
                  <span className="capitalize text-muted-foreground">
                    {name}
                  </span>
                  <span>{"$" + value.toLocaleString()}</span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="revenue"
          fill={`hsl(var(--primary))`}
          radius={remToPx(settings.radius)}
        />
      </BarChart>
    </ChartContainer>
  );
}
