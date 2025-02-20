"use client";

import type { PricingCardType } from "./types";

import { PricingCard } from "./pricing-card";

export function PricingCardList({ data }: { data: PricingCardType[] }) {
  return (
    <ul className="space-y-8 md:grid md:grid-cols-3 md:gap-x-4 md:space-y-0">
      {data.map((item) => (
        <PricingCard key={item.title} {...item} />
      ))}
    </ul>
  );
}
