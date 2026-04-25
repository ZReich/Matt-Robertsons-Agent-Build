"use client"

import type {
  BoardColumn,
  DealCard as DealCardData,
} from "@/lib/pipeline/server/board"
import type { DealStage } from "@prisma/client"

import { KanbanBoard } from "@/components/kanban/kanban-board"
import { DealCard } from "./deal-card"
import { DealColumnHeader } from "./deal-column-header"

export function DealsKanban({
  columns,
}: {
  columns: BoardColumn<DealCardData, DealStage>[]
}) {
  return (
    <KanbanBoard
      columns={columns}
      renderCard={(card) => <DealCard card={card} />}
      renderColumnHeader={(column) => <DealColumnHeader column={column} />}
      onMove={async (move) => {
        const response = await fetch(`/api/deals/${move.cardId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stage: move.toColumnId }),
        })
        if (!response.ok) throw new Error("Deal stage update failed")
      }}
    />
  )
}
