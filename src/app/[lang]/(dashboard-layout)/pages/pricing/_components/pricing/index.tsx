"use client";

import * as React from "react";

import type { PricingCardType } from "../../types";

import { PricingCard } from "./pricing-card";
import { PricingHeader } from "./pricing-header";

export default function Pricing({ data }: { data: PricingCardType[] }) {
  const [isAnnual, setIsAnnual] = React.useState(false);

  return (
    <section className="container p-4">
      <PricingHeader isAnnual={isAnnual} setIsAnnual={setIsAnnual} />
      <div className="space-y-8 md:grid md:grid-cols-3 md:space-x-4 md:space-y-0">
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
      </div>
    </section>
  );
}
