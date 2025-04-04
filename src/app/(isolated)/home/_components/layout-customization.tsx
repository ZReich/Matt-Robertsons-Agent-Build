import { LayoutCustomizationList } from "./layout-customization-list"

export function LayoutCustomization() {
  return (
    <section id="layout-customization" className="container grid gap-8">
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Layout Customization</h1>
        <p className="max-w-prose mx-auto">
          Shadboard lets you select from a variety of pre-defined layouts,
          orientations, and modes to seamlessly match your design needs and
          brand identity.
        </p>
      </div>
      <LayoutCustomizationList />
    </section>
  )
}
