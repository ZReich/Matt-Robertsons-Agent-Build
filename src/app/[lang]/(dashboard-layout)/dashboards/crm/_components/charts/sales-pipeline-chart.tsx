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
import { SalesPipelinetList } from "../sales-pipeline-list";
import { Separator } from "@/components/ui/separator";

export function SalesPipelineChart({ data }: { data: SalesPipelineType }) {
  return (
    <div className="flex flex-col justify-center items-center gap-6">
      <div className="flex justify-evenly items-center gap-x-6">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(data.summary).map(([key, value]) => (
            <div key={key} className="grid grid-cols-2 gap-1.5">
              <Badge className="flex-col shadow-none" aria-hidden>
                <p className="text-lg text-center">{value.toLocaleString()}</p>
              </Badge>
              <h4 className="text-xs">
                Total
                <br />
                {key.slice(5)}
              </h4>
            </div>
          ))}
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
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[325px] w-full"
      >
        <AreaChart
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
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Area
            dataKey="lead"
            type="natural"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.4}
            stroke="hsl(var(--chart-1))"
          />
          <Area
            dataKey="proposal"
            type="natural"
            fill="hsl(var(--chart-2))"
            fillOpacity={0.5}
            stroke="hsl(var(--chart-2))"
          />
          <Area
            dataKey="negotiation"
            type="natural"
            fill="hsl(var(--chart-3))"
            fillOpacity={0.6}
            stroke="hsl(var(--chart-3))"
          />
          <Area
            dataKey="closed"
            type="natural"
            fill="hsl(var(--chart-4))"
            fillOpacity={0.7}
            stroke="hsl(var(--chart-4))"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
