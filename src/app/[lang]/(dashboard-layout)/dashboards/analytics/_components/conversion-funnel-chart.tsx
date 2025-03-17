"use client"

import { Area, AreaChart, XAxis } from "recharts"

import type { ConversionFunnelType } from "../types"

import { ChartContainer } from "@/components/ui/chart"

export function ConversionFunnelChart({
  data,
}: {
  data: ConversionFunnelType["funnelSteps"]
}) {
  return (
    <ChartContainer config={{}} className="aspect-video h-44 w-full">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{
          left: 0,
          right: 0,
        }}
      >
        <XAxis dataKey="name" hide />
        <Area
          dataKey="value"
          type="bump"
          activeDot={false}
          fill="hsl(var(--chart-2))"
          fillOpacity={0.4}
          stroke="hsl(var(--chart-2))"
        />
      </AreaChart>
    </ChartContainer>
  )
}
