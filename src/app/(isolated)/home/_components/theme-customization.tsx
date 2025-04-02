import { ThemeCustomizer } from "./theme-customizer"
import { ThemePreview } from "./theme-preview"

export function ThemeCustomization() {
  return (
    <section
      id="theme-customization"
      className="container grid gap-4 p-4 pb-16"
    >
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Theme Customization</h1>
        <p className="max-w-prose mx-auto">
          Shadboard offers easy theme customization, allowing you to choose from
          pre-defined colors, border radii, and modes to match your brand’s
          identity effortlessly.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <ThemeCustomizer />
        <ThemePreview />
      </div>
    </section>
  )
}
