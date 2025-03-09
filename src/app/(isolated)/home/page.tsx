import { AppsAndPages } from "./_components/apps-and-pages"
import { CoreFeatures } from "./_components/core-features"
import { Faqs } from "./_components/faqs"
import { Hero } from "./_components/hero"
import { LayoutCustomization } from "./_components/layout-customization"
import { PricingPlans } from "./_components/pricing-plans"
import { ThemeCustomization } from "./_components/theme-customization"
import { ToolsAndTechnologies } from "./_components/tools-and-technologies"

export default function HomePage() {
  return (
    <div className="bg-muted/40">
      <Hero />
      <ThemeCustomization />
      <LayoutCustomization />
      <AppsAndPages />
      <ToolsAndTechnologies />
      <CoreFeatures />
      <PricingPlans />
      <Faqs />
    </div>
  )
}
