import { ToolsAndTechnologiesList } from "./tools-and-technologies-list"

export function ToolsAndTechnologies() {
  return (
    <section id="tools-and-technologies" className="container grid gap-6 py-16">
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Tools & Technologies</h1>
        <p className="max-w-prose mx-auto">
          Shadboard integrates cutting-edge technologies to provide a fast,
          reliable, and scalable solution for your projects.
        </p>
      </div>
      <ToolsAndTechnologiesList />
    </section>
  )
}
