import { CoreFeaturesList } from "./core-features-list"

export function CoreFeatures() {
  return (
    <section id="features" className="container grid gap-8">
      <div className="mx-auto text-center">
        <h1 className="text-3xl font-semibold">Core Features</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Shadboard provides all the essentials to create scalable,
          user-friendly applications, ensuring a smooth development process.
        </p>
      </div>
      <CoreFeaturesList />
    </section>
  )
}
