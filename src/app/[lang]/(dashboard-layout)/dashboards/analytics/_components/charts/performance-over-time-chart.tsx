"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChevronDown, Eye, RefreshCw } from "lucide-react";

import { chartConfig } from "@/configs/chart-config";

import { cn } from "@/lib/utils";

import type { PerformanceOverTimeType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function PerformanceOverTimeChart({
  data,
}: {
  data: PerformanceOverTimeType;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-evenly items-center gap-x-6">
        <div className="space-y-2">
          <div className="flex gap-x-2">
            <Badge
              style={{
                backgroundColor: "hsl(var(--chart-3))",
              }}
              className="size-12 aspect-square bg-chart-3 shadow-none"
              aria-hidden
            >
              <Eye className="size-full" />
            </Badge>
            <div className="shrink-0">
              <h4 className="text-xs">Total Visitors</h4>
              <p className="text-2xl">
                {data.summary.totalVisitors.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex gap-x-2">
            <Badge
              style={{
                backgroundColor: "hsl(var(--chart-5))",
              }}
              className="size-12 aspect-square bg-chart-5 shadow-none"
              aria-hidden
            >
              <RefreshCw className="size-full" />
            </Badge>
            <div className="shrink-0">
              <h4 className="text-xs">Total Conversions</h4>
              <p className="text-2xl">
                {data.summary.totalConversions.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <Separator orientation="vertical" className="h-20" />
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants(),
              "w-fit [&[data-state=open]>svg]:rotate-180"
            )}
          >
            <span>2024</span>
            <ChevronDown className="h-4 w-4 shrink-0 ms-2 transition-transform duration-200" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-fit">
            <DropdownMenuRadioGroup value="2024">
              <DropdownMenuRadioItem value="2024">2024</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="2023">2023</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="2022">2022</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChartContainer config={chartConfig} className="h-[288px] w-full">
        <LineChart
          accessibilityLayer
          data={data.monthly}
          margin={{
            left: 12,
            right: 12,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <YAxis yAxisId="left" hide />
          <YAxis yAxisId="right" orientation="right" hide />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Line
            dataKey="visitors"
            yAxisId="left"
            type="monotone"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            dataKey="conversions"
            yAxisId="right"
            type="monotone"
            stroke="hsl(var(--chart-5))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
