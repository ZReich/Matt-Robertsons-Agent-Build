import { layoutsData } from "../../_data/layout-customization"

import { CardDemo } from "../card-demo"

export function LayoutCustomizationList() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {layoutsData.map((layout) => (
        <CardDemo key={layout.title} {...layout} />
      ))}
    </div>
  )
}
