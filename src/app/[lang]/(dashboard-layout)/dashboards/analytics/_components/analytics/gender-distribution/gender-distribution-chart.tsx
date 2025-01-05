"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { formatPercent, remToPx } from "@/lib/utils";

import type { GenderDistributionType } from "../../../types";

import { useSettings } from "@/hooks/use-settings";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function FormattedChartTooltipContent({
  payload,
}: {
  payload: GenderDistributionType;
}) {
  const indicatorColor = payload.fill;

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-sm border-[--color-border] bg-[--color-bg]"
        style={
          {
            "--color-bg": indicatorColor,
            "--color-border": indicatorColor,
          } as React.CSSProperties
        }
      />
      <div className="flex flex-1 justify-between items-center leading-none">
        <div className="grid gap-1.5">
          <span className="text-muted-foreground">{payload.name}</span>
        </div>
        <span className="font-medium tabular-nums text-foreground">
          {payload.value.toLocaleString()}
        </span>
      </div>
    </div>
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
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(_value, _name, { payload }) => (
                  <FormattedChartTooltipContent payload={payload} />
                )}
              />
            }
          />
          <Bar dataKey="value" radius={remToPx(settings.radius) - 2} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
