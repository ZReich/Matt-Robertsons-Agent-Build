"use client";

import * as React from "react";
import {
  DragDropContext,
  DropResult,
  DroppableProvided,
} from "react-beautiful-dnd";
import { Plus } from "lucide-react";

import { StrictModeDroppable } from "@/lib/strict-mode-droppable";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "./kanban-column";
import { useKanbanContext } from "../hooks/use-kanban-context";

export const labels: { id: string; name: string }[] = [
  { id: "research", name: "Research" },
  { id: "design", name: "Design" },
  { id: "development", name: "Development" },
  { id: "meeting", name: "Meeting" },
  { id: "documentation", name: "Documentation" },
  { id: "qa", name: "QA" },
  { id: "marketing", name: "Marketing" },
];

export function Kanban() {
  const {
    kanbanState,
    handleReorderColumns,
    handleReorderTasks,
    setKanbanAddColumnSidebarIsOpen,
  } = useKanbanContext();

  const handleDragDrop = (result: DropResult) => {
    const { source, destination, type } = result;

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
        droppableId="root"
        type="Column"
        direction="horizontal"
      >
        {(provided: DroppableProvided) => (
          <ScrollArea orientation="horizontal">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex p-4"
            >
              {kanbanState.columns.map((column, index) => (
                <KanbanColumn key={column.id} column={column} index={index} />
              ))}
              {provided.placeholder}
              <AddNewColumn
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

function AddNewColumn({
  setKanbanAddColumnSidebarIsOpen,
}: {
  setKanbanAddColumnSidebarIsOpen: (value: boolean) => void;
}) {
  return (
    <Button
      variant="outline"
      className="w-64 md:w-72 shadow-none mx-2"
      onClick={() => setKanbanAddColumnSidebarIsOpen(true)}
    >
      <Plus className="me-2 size-4 text-muted-foreground" />
      Add New Column
    </Button>
  );
}
