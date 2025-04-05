import type { CoreFeatureType } from "../types"

import { Card } from "@/components/ui/card"

export function CoreFeaturesItem({ item }: { item: CoreFeatureType }) {
  return (
    <Card asChild>
      <li>
        <div className="flex items-center gap-1.5 p-6 pb-0">
          <item.icon className="h-8 w-8" />
          <h3 className="font-semibold">{item.title}</h3>
        </div>
        <p className="text-sm p-6">{item.description}</p>
      </li>
    </Card>
  )
}
