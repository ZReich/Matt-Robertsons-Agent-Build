import { pricingPlansData } from "../_data/pricing-plans"

import { PricingPlansList } from "./pricing-plans-list"

export function PricingPlans() {
  return (
    <section id="pricing-plans" className="container grid gap-8">
      <div className="mx-auto text-center">
        <h1 className="text-3xl font-semibold">Pricing Plans</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Shadboard offers exceptional value, saving you thousands in
          development costs. With every update, it grows more powerful, making
          it a smart investment for your projects.
        </p>
      </div>
      <PricingPlansList data={pricingPlansData} />
    </section>
  )
}
