"use client"

import { Funnel, FunnelChart } from "recharts"

import type { ConversionFunnelType } from "../types"

import { ChartContainer } from "@/components/ui/chart"

export function ConversionFunnelChart({
  data,
  chartRef,
}: {
  data: ConversionFunnelType["funnelSteps"]
  chartRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <ChartContainer
      ref={chartRef}
      config={{}}
      className="absolute inset-y-0 -end-1/2 h-full w-full"
    >
      <FunnelChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <Funnel
          dataKey="value"
          data={data}
          isAnimationActive
          strokeWidth={0}
          className="[clip-path:_inset(0_50%_0_0)] rtl:[clip-path:_inset(0_0_0_50%)]"
        />
      </FunnelChart>
    </ChartContainer>
  )
}
