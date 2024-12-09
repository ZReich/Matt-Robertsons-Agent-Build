"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  DragDropContext,
  DropResult,
  DroppableProvided,
} from "react-beautiful-dnd";

import { i18n } from "@/configs/i18n";

import { StrictModeDroppable } from "@/lib/strict-mode-droppable";

import type { LocaleType } from "@/configs/i18n";

import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./kanban-column";
import { useKanbanContext } from "../hooks/use-kanban-context";
import { KanbanAddNewColumnButton } from "./kanban-add-new-column-button";

export function Kanban() {
  const {
    kanbanState,
    handleReorderColumns,
    handleReorderTasks,
    setKanbanAddColumnSidebarIsOpen,
  } = useKanbanContext();
  const params = useParams();

  const locale = params.lang as LocaleType;
  const direction = i18n.langDirection[locale];

  const handleDragDrop = (result: DropResult) => {
    const { source, destination, type } = result;

    // Ignore if there's no destination
    if (!destination) return;

    if (type === "Column") {
      handleReorderColumns(source.index, destination.index);
    } else {
      handleReorderTasks(
        source.droppableId,
        source.index,
        destination.droppableId,
        destination.index
      );
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragDrop}>
      <StrictModeDroppable
        droppableId="root" // Unique identifier for the droppable area. Used to track drag-and-drop events
        type="Column" // Specifies the type of draggable items this droppable area will accept. Helps differentiate between column and task movements
        direction="horizontal" // Indicates the drag direction within the droppable area (horizontal layout for Kanban columns)
      >
        {/* A render callback function that provides the necessary props
        for the Droppable component to function properly */}
        {(provided: DroppableProvided) => (
          <ScrollArea
            orientation="horizontal"
            dir={direction}
            className="container p-4"
          >
            <div
              ref={provided.innerRef}
              {...provided.droppableProps} // Droppable props for drag-and-drop functionality
              className="flex gap-x-4"
            >
              {kanbanState.columns.map((column, index) => (
                <KanbanColumn key={column.id} column={column} index={index} />
              ))}
              {/* Placeholder for maintaining layout integrity by creating a visual space for the dragged item */}
              {provided.placeholder}
              <KanbanAddNewColumnButton
                setKanbanAddColumnSidebarIsOpen={
                  setKanbanAddColumnSidebarIsOpen
                }
              />
            </div>
          </ScrollArea>
        )}
      </StrictModeDroppable>
    </DragDropContext>
  );
}
