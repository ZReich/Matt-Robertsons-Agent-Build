"use client"

import type {
  BoardColumn,
  LeadCard as LeadCardData,
} from "@/lib/pipeline/server/board"
import type { LeadStatus } from "@prisma/client"

import { formatCurrency } from "@/lib/utils"

export function LeadColumnHeader({
  column,
}: {
  column: BoardColumn<LeadCardData, LeadStatus>
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{column.title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {column.aggregate.count}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {formatCurrency(column.aggregate.estimatedValue ?? 0)} estimated
      </div>
    </div>
  )
}
