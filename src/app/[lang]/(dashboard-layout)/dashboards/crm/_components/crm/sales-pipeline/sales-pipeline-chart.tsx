"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { cn, remToPx } from "@/lib/utils";

import type { ChartConfig } from "@/components/ui/chart";
import type { SalesPipelineType } from "../../../types";

import { useSettings } from "@/hooks/use-settings";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";

const chartConfig = {
  lead: {
    label: "Lead",
    color: "hsl(var(--chart-1))",
  },
  proposal: {
    label: "Proposal",
    color: "hsl(var(--chart-2))",
  },
  negotiation: {
    label: "Negotiation",
    color: "hsl(var(--chart-3))",
  },
  closed: {
    label: "Closed",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

export function SalesPipelineChart({ data }: { data: SalesPipelineType }) {
  const [activeChart, setActiveChart] =
    React.useState<keyof typeof chartConfig>("lead");
  const { settings } = useSettings();

  const { monthly, summary } = data;
  const radius = remToPx(settings.radius) - 2;

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(summary).map(([key, value]) => {
          const stage = key
            .replace("total", "")
            .toLowerCase() as keyof typeof chartConfig;

          return (
            <Button
              key={key}
              variant="ghost"
              className={cn(
                "size-auto flex-col",
                activeChart === stage && "bg-accent"
              )}
              onClick={() => setActiveChart(stage)}
            >
              <span className="text-xs">{chartConfig[stage].label}</span>
              <span
                style={{
                  color: chartConfig[stage].color,
                }}
                className="text-3xl font-semibold"
              >
                {value.toLocaleString()}
              </span>
            </Button>
          );
        })}
      </div>
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
        <BarChart accessibilityLayer key={activeChart} data={monthly}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Bar
            dataKey={activeChart}
            fill={chartConfig[activeChart].color}
            radius={radius}
          />
        </BarChart>
      </ChartContainer>
    </>
  );
}
