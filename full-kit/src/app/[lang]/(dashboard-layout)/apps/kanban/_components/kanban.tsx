// Refer to react-beautiful-dnd README.md file for more details https://github.com/atlassian/react-beautiful-dnd
"use client"

import { DragDropContext } from "@hello-pangea/dnd"

import type { DropResult } from "@hello-pangea/dnd"

import { useKanbanContext } from "../_hooks/use-kanban-context"
import { KanbanColumnList } from "./kanban-column-list"
import { PipelineHeader } from "./pipeline-header"

export function Kanban() {
  const { handleReorderColumns, handleReorderTasks, kanbanState } =
    useKanbanContext()

  const handleDragDrop = (result: DropResult) => {
    const { source, destination, type } = result

    if (!destination) return

    if (type === "Column") {
      handleReorderColumns(source.index, destination.index)
    } else {
      // Fire vault PATCH when deal moves to a different stage column
      if (source.droppableId !== destination.droppableId) {
        const sourceColumn = kanbanState.columns.find(
          (c) => c.id === source.droppableId
        )
        const movedTask = sourceColumn?.tasks[source.index]
        if (movedTask?.dealPath) {
          fetch("/api/vault/deals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: movedTask.dealPath,
              stage: destination.droppableId,
            }),
          }).catch(console.error)
        }
      }

      handleReorderTasks(
        source.droppableId,
        source.index,
        destination.droppableId,
        destination.index
      )
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PipelineHeader />
      <DragDropContext onDragEnd={handleDragDrop}>
        <KanbanColumnList />
      </DragDropContext>
    </div>
  )
}
