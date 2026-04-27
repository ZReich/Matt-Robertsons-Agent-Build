"use client"

import { Draggable, Droppable } from "@hello-pangea/dnd"

import type { ReactNode } from "react"
import type { KanbanColumnData } from "./types"

import { KanbanColumn } from "./kanban-column"

export function KanbanColumnList<
  TKey extends string,
  TCard extends { id: string },
>({
  column,
  renderCard,
  renderHeader,
}: {
  column: KanbanColumnData<TKey, TCard>
  renderCard: (card: TCard) => ReactNode
  renderHeader: (column: KanbanColumnData<TKey, TCard>) => ReactNode
}) {
  return (
    <KanbanColumn header={renderHeader(column)}>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`grid min-h-[18rem] content-start gap-2 rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
          >
            {column.cards.map((card, index) => (
              <Draggable
                key={card.id}
                draggableId={card.id}
                index={index}
                disableInteractiveElementBlocking
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={
                      dragSnapshot.isDragging ? "opacity-80" : undefined
                    }
                  >
                    {renderCard(card)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </KanbanColumn>
  )
}
