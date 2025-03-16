"use client"

import type { ConversionFunnelType } from "../types"

import { ConversionFunnelItem } from "./conversion-funnel-item"

export function ConversionFunnelList({
  data,
  trapezoidHeight,
}: {
  data: ConversionFunnelType["funnelSteps"]
  trapezoidHeight: number
}) {
  return (
    <ul
      style={{
        gridTemplateRows: `repeat(${data.length}, ${trapezoidHeight}px)`,
      }}
      className="absolute inset-0 grid divide-y"
    >
      {data.map((stage) => (
        <ConversionFunnelItem key={stage.name} data={stage} />
      ))}
    </ul>
  )
}
