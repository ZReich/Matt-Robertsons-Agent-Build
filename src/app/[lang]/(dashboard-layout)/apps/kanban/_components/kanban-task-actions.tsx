"use client";

import { EllipsisVertical } from "lucide-react";

import { useKanbanContext } from "../hooks/use-kanban-context";

import type { TaskType } from "../types";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface KanbanTaskCardActionsProps {
  task: TaskType;
}

export function KanbanTaskCardActions({ task }: KanbanTaskCardActionsProps) {
  const {
    setKanbanUpdateTaskSidebarIsOpen,
    handleSelectTask,
    handleDeleteTask,
  } = useKanbanContext();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 ms-auto data-[state=open]:bg-muted"
        >
          <EllipsisVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={() => {
            handleSelectTask(task);
            setKanbanUpdateTaskSidebarIsOpen(true);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem>Make a copy</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => handleDeleteTask(task.id)}
        >
          Delete
          <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
