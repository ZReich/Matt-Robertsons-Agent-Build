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

  return (
    <ul className="space-y-8 md:grid md:grid-cols-3 md:gap-x-4 md:space-y-0">
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
