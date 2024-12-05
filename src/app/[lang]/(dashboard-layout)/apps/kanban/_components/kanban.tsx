"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  DragDropContext,
  DropResult,
  DroppableProvided,
} from "react-beautiful-dnd";
import { Plus } from "lucide-react";

import { i18n } from "@/configs/i18n";

import { StrictModeDroppable } from "@/lib/strict-mode-droppable";

import type { LocaleType } from "@/configs/i18n";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "./kanban-column";
import { useKanbanContext } from "../hooks/use-kanban-context";

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
          <ScrollArea
            orientation="horizontal"
            dir={direction}
            className="container p-4"
          >
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-x-4"
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
