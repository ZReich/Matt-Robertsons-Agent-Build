"use client";

import type { PricingCardType } from "../../types";

import { PricingCard } from "./pricing-card";

export default function PricingCardList({
  data,
  isAnnual,
}: {
  data: PricingCardType[];
  isAnnual: boolean;
}) {
  return (
    <ul className="space-y-8 md:grid md:grid-cols-3 md:gap-x-4 md:space-y-0">
      {data.map((item) => (
        <PricingCard
          key={item.title}
          title={item.title}
          description={item.description}
          price={item.price}
          features={item.features}
          isCurrentPlan={item.isCurrentPlan}
          isPopular={item.isPopular}
          isAnnual={isAnnual}
        />
      ))}
    </ul>
  );
}
