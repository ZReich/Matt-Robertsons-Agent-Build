import { appsAndPagesData } from "../../../_data/apps-and-pages"

import { CardDemo } from "../../card-demo"

export function AppsAndPagesList() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {appsAndPagesData.map((layout) => (
        <CardDemo key={layout.title} {...layout} />
      ))}
    </div>
  )
}
