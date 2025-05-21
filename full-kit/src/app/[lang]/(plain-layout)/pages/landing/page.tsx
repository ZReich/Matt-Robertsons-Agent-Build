import { ContactUs } from "./_components/contact-us"
import { CoreFeatures } from "./_components/core-features"
import { Faqs } from "./_components/faqs"
import { LandingHero } from "./_components/landing-hero"
import { PricingPlans } from "./_components/pricing-plans"
import { ReadyToBuild } from "./_components/ready-to-build"
import { WhatPeopleSay } from "./_components/what-people-say"

export default function LandingPage() {
  return (
    <div className="py-16 space-y-20 bg-muted/40">
      <LandingHero />
      <CoreFeatures />
      <WhatPeopleSay />
      <PricingPlans />
      <Faqs />
      <ReadyToBuild />
      <ContactUs />
    </div>
  )
}
