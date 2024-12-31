"use client";

import * as React from "react";
import { Draggable, DraggableProvided } from "react-beautiful-dnd";

import type { TaskType } from "../../../../../../types";

import { Card } from "@/components/ui/card";
import { KanbanTaskItemHeader } from "./kanban-task-item-header";
import { KanbanTaskItemContent } from "./kanban-task-item-content";
import { KanbanTaskItemFooter } from "./kanban-task-item-footer";

interface KanbanTaskItemProps {
  task: TaskType;
  index: number;
}

export const KanbanTaskItem = React.memo(
  ({ task, index }: KanbanTaskItemProps) => {
    return (
      <Draggable
        draggableId={task.id} // A unique identifier for this task, which helps the library track and move the item
        index={index} // The position of this task in its column, used for reordering tasks when drag-and-drop occurs
      >
        {/* A render callback function that provides the necessary props
        for the Draggable component to function properly */}
        {(provided: DraggableProvided) => (
          <Card
            ref={provided.innerRef}
            className="my-2 w-64 md:w-72"
            {...provided.draggableProps} // Draggable props for drag-and-drop functionality
          >
            <KanbanTaskItemHeader task={task} provided={provided} />
            <KanbanTaskItemContent task={task} />
            <KanbanTaskItemFooter task={task} />
          </Card>
        )}
      </Draggable>
    );
  }
);
KanbanTaskItem.displayName = "KanbanTaskItem";
