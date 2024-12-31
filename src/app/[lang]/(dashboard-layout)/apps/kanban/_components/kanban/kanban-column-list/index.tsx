"use client";

import * as React from "react";
import { DroppableProvided } from "react-beautiful-dnd";

import { StrictModeDroppable } from "@/lib/strict-mode-droppable";

import { useKanbanContext } from "../../../hooks/use-kanban-context";

import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanColumnItem } from "./kanban-column-item";
import { KanbanAddNewColumnButton } from "./kanban-add-new-column-button";

export function KanbanColumnList() {
  const { kanbanState, setKanbanAddColumnSidebarIsOpen } = useKanbanContext();

  return (
    <ScrollArea orientation="horizontal" className="container p-0">
      <StrictModeDroppable
        droppableId="root" // Unique identifier for the droppable area. Used to track drag-and-drop events
        type="Column" // Specifies the type of draggable items this droppable area will accept. Helps differentiate between column and task movements
        direction="horizontal" // Indicates the drag direction within the droppable area (horizontal layout for Kanban columns)
      >
        {/* A render callback function that provides the necessary props for the Droppable component to function properly */}
        {(provided: DroppableProvided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps} // Droppable props for drag-and-drop functionality
            className="flex p-4 space-x-4"
          >
            {kanbanState.columns.map((column, index) => (
              <KanbanColumnItem key={column.id} column={column} index={index} />
            ))}
            {/* Placeholder for maintaining layout integrity by creating a visual space for the dragged item */}
            {provided.placeholder}
            <KanbanAddNewColumnButton
              setKanbanAddColumnSidebarIsOpen={setKanbanAddColumnSidebarIsOpen}
            />
          </div>
        )}
      </StrictModeDroppable>
    </ScrollArea>
  );
}
