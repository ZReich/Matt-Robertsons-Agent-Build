"use client"

import type { ConversionFunnelType } from "../types"

import { ConversionFunnelItem } from "./conversion-funnel-item"

export function ConversionFunnelList({
  data,
}: {
  data: ConversionFunnelType["funnelSteps"]
}) {
  return (
    <ul
      style={{
        gridTemplateColumns: `repeat(${data.length}, 1fr)`,
      }}
      className="w-full grid px-6 space-x-3 divide-x"
    >
      {data.map((stage) => (
        <ConversionFunnelItem key={stage.name} data={stage} />
      ))}
    </ul>
  )
}
