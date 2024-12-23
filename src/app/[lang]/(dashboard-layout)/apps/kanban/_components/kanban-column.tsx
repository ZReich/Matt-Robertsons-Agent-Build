"use client";

import { Draggable, DraggableProvided, Droppable } from "react-beautiful-dnd";
import { GripVertical, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ColumnType } from "../types";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { KanbanTaskCard } from "./kanban-task-card";
import { useKanbanContext } from "../hooks/use-kanban-context";
import { KanbanColumnActions } from "./kanban-column-actions";

interface KanbanColumnProps {
  column: ColumnType;
  index: number;
}

export function KanbanColumn({ column, index }: KanbanColumnProps) {
  const { handleSelectColumn, setKanbanAddTaskSidebarIsOpen } =
    useKanbanContext();

  return (
    <Draggable
      draggableId={column.id} // A unique identifier for this column, which helps the library track and move the item
      index={index} // The position of this column in the root, used for reordering columns when drag-and-drop occurs
    >
      {/* A render callback function that provides the necessary props
        for the Draggable component to function properly */}
      {(provided: DraggableProvided) => (
        <div
          ref={provided.innerRef}
          className="w-64 h-fit md:w-72"
          {...provided.draggableProps} // Draggable props for drag-and-drop functionality
        >
          <CardHeader className="flex-row items-center space-y-0 gap-x-1.5 p-0">
            <div
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "text-secondary-foreground/50 cursor-grab"
              )}
              {...provided.dragHandleProps} // Draggable props for drag-and-drop functionality
              aria-label="Move task"
            >
              <GripVertical className="size-4" />
            </div>
            <CardTitle className="me-auto">{column.title}</CardTitle>
            <KanbanColumnActions column={column} />
          </CardHeader>
          <Droppable
            droppableId={column.id} // A unique identifier for this column, which helps the library track and move the item
          >
            {/* A render callback function that provides the necessary props
            for the Droppable component to function properly */}
            {(provided) => (
              <>
                <CardContent
                  ref={provided.innerRef}
                  className="grid p-0 min-h-44"
                  {...provided.droppableProps} // Droppable props for drag-and-drop functionality
                >
                  {column.tasks.map((task, index) => (
                    <KanbanTaskCard key={task.id} task={task} index={index} />
                  ))}
                  {/* Placeholder for maintaining layout integrity by creating a visual space for the dragged item */}
                  {provided.placeholder}
                  <Button
                    variant="outline"
                    className="w-full shadow-none my-2"
                    onClick={() => {
                      handleSelectColumn(column);
                      setKanbanAddTaskSidebarIsOpen(true);
                    }}
                  >
                    <Plus className="me-2 size-4 text-muted-foreground" />
                    Add New Task
                  </Button>
                </CardContent>
              </>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}
