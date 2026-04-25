"use client"

import { useEffect, useState } from "react"
import { DragDropContext } from "@hello-pangea/dnd"
import { toast } from "sonner"

import type { DropResult } from "@hello-pangea/dnd"
import type { ReactNode } from "react"
import type { KanbanColumnData, KanbanMove } from "./types"

import { KanbanColumnList } from "./kanban-column-list"
import { KanbanContext } from "./kanban-context"
import { moveKanbanCard } from "./kanban-reducer"

export function KanbanBoard<TKey extends string, TCard extends { id: string }>({
  columns,
  renderCard,
  renderColumnHeader,
  onMove,
}: {
  columns: KanbanColumnData<TKey, TCard>[]
  renderCard: (card: TCard) => ReactNode
  renderColumnHeader: (column: KanbanColumnData<TKey, TCard>) => ReactNode
  onMove?: (move: KanbanMove<TKey>) => Promise<void> | void
}) {
  const [localColumns, setLocalColumns] = useState(columns)

  useEffect(() => setLocalColumns(columns), [columns])

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const move: KanbanMove<TKey> = {
      cardId: result.draggableId,
      fromColumnId: result.source.droppableId as TKey,
      toColumnId: result.destination.droppableId as TKey,
      fromIndex: result.source.index,
      toIndex: result.destination.index,
    }
    if (
      move.fromColumnId === move.toColumnId &&
      move.fromIndex === move.toIndex
    )
      return

    const previous = localColumns
    setLocalColumns((current) => moveKanbanCard(current, move))

    if (move.fromColumnId !== move.toColumnId && onMove) {
      try {
        await onMove(move)
      } catch (error) {
        setLocalColumns(previous)
        toast.error(
          error instanceof Error ? error.message : "Could not update card"
        )
      }
    }
  }

  return (
    <KanbanContext.Provider value={{}}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {localColumns.map((column) => (
            <KanbanColumnList
              key={column.id}
              column={column}
              renderCard={renderCard}
              renderHeader={renderColumnHeader}
            />
          ))}
        </div>
      </DragDropContext>
    </KanbanContext.Provider>
  )
}
