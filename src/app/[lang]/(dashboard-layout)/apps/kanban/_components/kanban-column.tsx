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

export const KanbanColumn = ({ column, index }: KanbanColumnProps) => {
  const { handleSelectColumn, setKanbanAddTaskSidebarIsOpen } =
    useKanbanContext();

  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided: DraggableProvided) => (
        <div
          ref={provided.innerRef}
          className="w-64 h-fit mx-2 md:w-72"
          {...provided.draggableProps}
        >
          <CardHeader className="flex-row items-center space-y-0 gap-x-1.5 p-0">
            <div
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "text-secondary-foreground/50 cursor-grab"
              )}
              {...provided.dragHandleProps}
            >
              <GripVertical className="size-4" />
              <span className="sr-only">Move task</span>
            </div>
            <CardTitle className="me-auto">{column.title}</CardTitle>
            <KanbanColumnActions column={column} />
          </CardHeader>
          <Droppable droppableId={column.id}>
            {(provided) => (
              <>
                <CardContent
                  ref={provided.innerRef}
                  className="grid p-0 min-h-44"
                  {...provided.droppableProps}
                >
                  {column.tasks.map((task, index) => (
                    <KanbanTaskCard key={task.id} task={task} index={index} />
                  ))}
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
};
