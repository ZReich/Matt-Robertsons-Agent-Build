import { CoreFeatures } from "./_components/core-features"
import { LandingHero } from "./_components/landing-hero"
import { PricingPlans } from "./_components/pricing-plans"
import { WhatPeopleSay } from "./_components/what-people-say"

export default function LandingPage() {
  return (
    <div className="py-16 space-y-20 bg-muted/40">
      <LandingHero />
      <CoreFeatures />
      <WhatPeopleSay />
      <PricingPlans />
    </div>
  )
}
