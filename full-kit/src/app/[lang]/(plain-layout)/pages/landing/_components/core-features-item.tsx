import type { CoreFeatureType } from "../types"

import { Card, CardDescription, CardTitle } from "@/components/ui/card"

export function CoreFeaturesItem({ item }: { item: CoreFeatureType }) {
  return (
    <Card asChild>
      <li className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <item.icon className="shrink-0 h-8 w-8 text-primary" />
          <CardTitle>{item.title}</CardTitle>
        </div>
        <CardDescription>{item.description}</CardDescription>
      </li>
    </Card>
  )
}
