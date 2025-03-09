import { coreFeaturesData } from "../../../_data/core-features"

import { CoreFeaturesItem } from "./core-features-item"

export function CoreFeaturesList() {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {coreFeaturesData.map((item) => (
        <CoreFeaturesItem key={item.title} item={item} />
      ))}
    </ul>
  )
}
