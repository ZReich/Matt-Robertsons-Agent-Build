import { CoreFeatures } from "./_components/core-features"
import { LandingHero } from "./_components/landing-hero"

export default function LandingPage() {
  return (
    <div className="py-16 space-y-20 bg-muted/40">
      <LandingHero />
      <CoreFeatures />
    </div>
  )
}
