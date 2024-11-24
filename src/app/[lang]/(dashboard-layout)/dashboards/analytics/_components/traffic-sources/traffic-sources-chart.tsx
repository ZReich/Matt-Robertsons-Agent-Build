"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { cn } from "@/lib/utils";

import type { TrafficSourcesType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function TrafficSourcesChart({ data }: { data: TrafficSourcesType }) {
  const isPositiveTotalChange = data.summary.totalPercentageChange >= 0;

  return (
    <div
      className={cn(
        "flex flex-col justify-center items-center pb-6 sm:flex-row sm:pb-0"
      )}
    >
      <ChartContainer config={chartConfig} className="size-[272px]">
        <PieChart accessibilityLayer>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data.sources}
            dataKey="visitors"
            nameKey="name"
            innerRadius={60}
            strokeWidth={5}
          >
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
                        className="fill-foreground text-3xl font-bold"
                      >
                        {data.summary.totalVisitors.toLocaleString()}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 24}
                        className="fill-muted-foreground"
                      >
                        Visitors
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 40}
                        className={
                          isPositiveTotalChange
                            ? "fill-success"
                            : "fill-destructive"
                        }
                      >
                        {new Intl.NumberFormat("en-US", {
                          style: "percent",
                          maximumFractionDigits: 2,
                        }).format(data.summary.totalPercentageChange)}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-2 sm:me-6">
        {data.sources.map((source) => {
          const isPositiveChange = source.percentageChange >= 0;

          return (
            <li
              key={source.name}
              className="flex justify-between items-center gap-x-4"
            >
              <div className="flex items-center gap-x-2">
                <div
                  style={{ backgroundColor: source.fill }}
                  className="shrink-0 size-2 rounded-sm"
                />
                <p className="w-max text-foreground">{source.name}</p>
              </div>
              <Badge
                variant="destructive"
                className={cn(
                  "w-max justify-center",
                  isPositiveChange && "bg-success hover:bg-success/90"
                )}
              >
                {isPositiveChange && <span>+</span>}
                <span>
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                    maximumFractionDigits: 2,
                  }).format(source.percentageChange)}
                </span>
                <span className="ms-1" aria-hidden>
                  {isPositiveChange ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                </span>
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
