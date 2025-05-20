"use client"

import type { PricingPlansType } from "../types"

import { PricingPlansItem } from "./pricing-plans-item"

export function PricingPlansList({ data }: { data: PricingPlansType[] }) {
  const itemsCount = data.length

  return (
    <ul
      style={{ gridTemplateColumns: `repeat(${itemsCount}, minmax(0, 1fr))` }}
      className="grid gap-y-8 gap-x-4 max-md:!grid-cols-1"
    >
      {data.map((item) => (
        <PricingPlansItem key={item.title} {...item} />
      ))}
    </ul>
  )
}
