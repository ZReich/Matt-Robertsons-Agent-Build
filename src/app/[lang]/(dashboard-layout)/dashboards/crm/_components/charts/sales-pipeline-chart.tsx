"use client";

import { XAxis, CartesianGrid, Area, AreaChart } from "recharts";
import { ChevronDown } from "lucide-react";

import { chartConfig } from "@/configs/chart-config";

import { cn } from "@/lib/utils";

import type { SalesPipelineType } from "../../types";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";

export function SalesPipelineChart({ data }: { data: SalesPipelineType }) {
  return (
    <div className="flex flex-col justify-center items-center gap-6">
      <div className="flex flex-col justify-evenly items-center gap-y-6">
        <div className="flex justify-between items-center gap-x-2">
          {Object.entries(data.summary).map(([key, value], index) => (
            <Badge
              key={key}
              variant="secondary"
              className="shrink-0 flex-col shadow-none"
              aria-hidden
            >
              <p className="text-2xl text-center">{value.toLocaleString()}</p>
              <h4 className="text-xs">Total {key.slice(5)}</h4>
            </Badge>
          ))}
        </div>
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
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[250px] w-full"
      >
        <AreaChart accessibilityLayer data={data.monthly}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Area
            dataKey="lead"
            type="natural"
            fill="hsl(var(--chart-1))"
            stroke="hsl(var(--chart-1))"
            fillOpacity={0.8}
          />
          <Area
            dataKey="proposal"
            type="natural"
            fill="hsl(var(--chart-2))"
            stroke="hsl(var(--chart-2))"
            fillOpacity={0.8}
          />
          <Area
            dataKey="negotiation"
            type="natural"
            fill="hsl(var(--chart-3))"
            stroke="hsl(var(--chart-3))"
            fillOpacity={0.8}
          />
          <Area
            dataKey="closed"
            type="natural"
            fill="hsl(var(--chart-4))"
            stroke="hsl(var(--chart-4))"
            fillOpacity={0.8}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
