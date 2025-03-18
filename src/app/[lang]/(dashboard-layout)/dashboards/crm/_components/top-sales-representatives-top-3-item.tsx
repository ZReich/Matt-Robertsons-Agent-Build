import type { SalesRepresentativeType } from "../types"

import { cn, getInitials } from "@/lib/utils"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const medalAvatarColor = [
  "bg-yellow-400 border-yellow-400 dark:bg-yellow-500 dark:border-yellow-500",
  "bg-gray-300 border-gray-300 dark:bg-gray-400 dark:border-gray-400",
  "bg-amber-600 border-amber-600 dark:bg-amber-700 dark:border-amber-700",
]

export function TopSalesRepresentativesTop3Item({
  representative,
  index,
}: {
  representative: SalesRepresentativeType["representatives"][0]
  index: number
}) {
  return (
    <li key={representative.name}>
      <Card>
        <CardContent className="flex items-center gap-x-4 py-3 px-6">
          <div className="relative">
            <Avatar
              className={cn(
                "w-10 h-10 border-2 border-secondary bg-secondary",
                medalAvatarColor[index]
              )}
            >
              <AvatarImage src={representative.avatar} alt="Avatar" />
              <AvatarFallback>
                {getInitials(representative.name)}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "absolute -top-2 -right-2 w-6 h-6 border-secondary bg-secondary rounded-full flex items-center justify-center text-xs text-secondary-foreground font-semibold",
                medalAvatarColor[index]
              )}
            >
              {index + 1}
            </div>
          </div>
          <div className="flex-1 w-0">
            <h3 className="text-sm font-semibold break-all truncate">
              {representative.name}
            </h3>
            <p className="text-xs text-muted-foreground break-all truncate">
              {representative.email}
            </p>
          </div>
          <Badge className="text-sm">
            ${representative.sales.toLocaleString()}
          </Badge>
        </CardContent>
      </Card>
    </li>
  )
}
