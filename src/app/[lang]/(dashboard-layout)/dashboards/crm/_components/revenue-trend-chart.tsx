"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import type {
  ChartConfig,
  ChartTooltipContentProps,
} from "@/components/ui/chart"
import type { RevenueTrendType } from "../types"

import { formatCurrency } from "@/lib/utils"

import { useIsRtl } from "@/hooks/use-is-rtl"
import { useRadius } from "@/hooks/use-radius"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  revenue: {
    label: "Revenue",
  },
} satisfies ChartConfig

function ModifiedChartTooltipContent(props: ChartTooltipContentProps) {
  if (!props.payload || props.payload.length === 0) return null

  return (
    <ChartTooltipContent
      {...props}
      payload={props.payload.map((item) => ({
        ...item,
        value: formatCurrency(Number(item.value)),
      }))}
    />
  )
}

export function RevenueTrendChart({
  data,
}: {
  data: RevenueTrendType["revenueTrends"]
}) {
  const radius = useRadius()
  const isRtl = useIsRtl()

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[4.5rem] w-full"
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={{
          left: 0,
          right: 0,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          reversed={isRtl}
          dataKey="month"
          tickLine={false}
          axisLine={false}
          hide
        />
        <ChartTooltip content={<ModifiedChartTooltipContent hideIndicator />} />
        <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={radius} />
      </BarChart>
    </ChartContainer>
  )
}
