import type { CoreFeatureType } from "../types"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function CoreFeaturesItem({ item }: { item: CoreFeatureType }) {
  return (
    <Card asChild>
      <li className="text-center">
        <CardHeader className="items-center">
          <item.icon className="h-8 w-8 text-primary" />
          <CardTitle>{item.title}</CardTitle>
          <CardDescription>{item.description}</CardDescription>
        </CardHeader>
      </li>
    </Card>
  )
}
