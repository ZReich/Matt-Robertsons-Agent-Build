"use client"

import type { PricingCardType } from "../types"

import { PricingCard } from "./pricing-card"

export function PricingCardList({ data }: { data: PricingCardType[] }) {
  const itemsCount = data.length

  return (
    <ul
      style={{ gridTemplateColumns: `repeat(${itemsCount}, minmax(0, 1fr))` }}
      className="grid gap-y-8 gap-x-4 max-md:!grid-cols-1"
    >
      {data.map((item) => (
        <PricingCard key={item.title} {...item} />
      ))}
    </ul>
  )
}
