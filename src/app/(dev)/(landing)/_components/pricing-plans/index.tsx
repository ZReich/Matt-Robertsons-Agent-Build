import { pricingPlansData } from "../../_data/pricing-plans";

import { PricingCardList } from "./pricing-card-list";

export function PricingPlans() {
  return (
    <section id="pricing-plans" className="container grid gap-6 p-4 py-16">
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Pricing Plans</h1>
        <p className="max-w-prose mx-auto">
          Shadboard offers exceptional value, saving you thousands in
          development costs. With every update, it grows more powerful, making
          it a smart investment for your projects.
        </p>
      </div>
      <PricingCardList data={pricingPlansData} />
    </section>
  );
}
