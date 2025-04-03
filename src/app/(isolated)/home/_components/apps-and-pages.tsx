import { AppsAndPagesList } from "./apps-and-pages-list"

export function AppsAndPages() {
  return (
    <section id="apps-and-pages" className="container grid gap-6 py-16">
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Apps & Pages</h1>
        <p className="max-w-prose mx-auto">
          Shadboard offers a collection of pre-built apps and pages that can be
          easily integrated into your project, helping you save time and effort.
        </p>
      </div>
      <AppsAndPagesList />
    </section>
  )
}
