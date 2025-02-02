"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { formatPercent, remToPx } from "@/lib/utils";

import type { GenderDistributionType } from "../../../types";
import type { ChartTooltipContentProps } from "@/components/ui/chart";

import { useSettings } from "@/hooks/use-settings";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function ModifiedChartTooltipContent(props: ChartTooltipContentProps) {
  if (!props.payload || props.payload.length === 0) return null;

  return (
    <ChartTooltipContent
      {...props}
      payload={props.payload.map((item) => ({
        ...item,
        name: item.payload.name,
      }))}
    />
  );
}

export function GenderDistributionChart({
  data,
}: {
  data: GenderDistributionType[];
}) {
  const { settings } = useSettings();

  return (
    <div className="flex flex-col justify-between items-center gap-2 lg:flex-row">
      <ul className="flex gap-2 lg:flex-col lg:gap-0">
        {data.map((gender) => (
          <li key={gender.name}>
            <div className="flex items-center gap-x-2">
              <div
                style={{
                  backgroundColor: gender.fill,
                  borderColor: gender.fill,
                }}
                className="h-2.5 w-2.5 rounded-sm"
              />
              <h4 className="text-sm text-muted-foreground">{gender.name}</h4>
            </div>
            <p className="text-lg">
              {gender.value.toLocaleString()} (
              {formatPercent(gender.percentage)})
            </p>
          </li>
        ))}
      </ul>
      <ChartContainer config={{}} className="aspect-video h-[150px]">
        <BarChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <ChartTooltip
            cursor={false}
            content={<ModifiedChartTooltipContent hideLabel />}
          />
          <Bar dataKey="value" radius={remToPx(settings.radius) - 2} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
