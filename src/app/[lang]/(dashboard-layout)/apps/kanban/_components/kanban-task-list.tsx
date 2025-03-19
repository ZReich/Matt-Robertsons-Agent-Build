"use client"

import { memo } from "react"
import { Droppable } from "@hello-pangea/dnd"

import type { DroppableProvided } from "@hello-pangea/dnd"
import type { ColumnType } from "../types"

import { CardContent } from "@/components/ui/card"
import { KanbanAddNewTaskButton } from "./kanban-add-new-task-button"
import { KanbanTaskItem } from "./kanban-task-item"

interface KanbanTaskListProps {
  column: ColumnType
}

export const KanbanTaskList = memo(({ column }: KanbanTaskListProps) => {
  return (
    <Droppable
      droppableId={column.id} // A unique identifier for this column, which helps the library track and move the item
    >
      {/* A render callback function that provides the necessary props for the Droppable component to function properly */}
      {(provided: DroppableProvided) => (
        <CardContent
          ref={provided.innerRef}
          className="grid p-0 min-h-44"
          {...provided.droppableProps} // Droppable props for drag-and-drop functionality
        >
          {column.tasks.map((task, index) => (
            <KanbanTaskItem key={task.id} task={task} index={index} />
          ))}
          {/* Placeholder for maintaining layout integrity by creating a visual space for the dragged item */}
          {provided.placeholder}
          <KanbanAddNewTaskButton column={column} />
        </CardContent>
      )}
    </Droppable>
  )
})
KanbanTaskList.displayName = "KanbanTaskList"
