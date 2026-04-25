"use client"

import type {
  BoardColumn,
  DealCard as DealCardData,
} from "@/lib/pipeline/server/board"
import type { DealStage } from "@prisma/client"

import { formatCurrency } from "@/lib/utils"

export function DealColumnHeader({
  column,
}: {
  column: BoardColumn<DealCardData, DealStage>
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
        {formatCurrency(column.aggregate.grossValue ?? 0)} gross ·{" "}
        {formatCurrency(column.aggregate.weightedValue ?? 0)} weighted
      </div>
    </div>
  )
}
