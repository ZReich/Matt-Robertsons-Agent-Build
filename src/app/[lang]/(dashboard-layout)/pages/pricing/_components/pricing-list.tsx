"use client"

import type { PricingType } from "../types"

import { PricingItem } from "./pricing-item"

export default function PricingList({
  data,
  isAnnual,
}: {
  data: PricingType[]
  isAnnual: boolean
}) {
  const discountRate = isAnnual ? 0.15 : 0
  const itemsCount = data.length

  return (
    <ul
      style={{ gridTemplateColumns: `repeat(${itemsCount}, minmax(0, 1fr))` }}
      className="grid gap-y-8 gap-x-4 max-md:!grid-cols-1"
    >
      {data.map((item) => (
        <PricingItem
          key={item.title}
          title={item.title}
          description={item.description}
          price={item.price}
          period={item.period}
          discountRate={discountRate}
          features={item.features}
          isCurrentPlan={item.isCurrentPlan}
          isFeatured={item.isFeatured}
          href={item.href}
        />
      ))}
    </ul>
  )
}
