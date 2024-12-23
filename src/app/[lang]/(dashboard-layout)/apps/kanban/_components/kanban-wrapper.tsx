import { kanbanData } from "../_data/kanban";

import { KanbanProvider } from "../contexts/kanban-context";

import type { ColumnType } from "../types";

import { KanbanAddTaskSidebar } from "./kanban-add-task-sidebar";
import { KanbanUpdateTaskSidebar } from "./kanban-update-task-sidebar";
import { KanbanAddColumnSidebar } from "./kanban-add-column-sidebar";
import { KanbanUpdateColumnSidebar } from "./kanban-update-column-sidebar";

export function KanbanWrapper({
  kanban,
  children,
}: {
  kanban: ColumnType[];
  children: React.ReactNode;
}) {
  return (
    <KanbanProvider kanban={kanban}>
      {children}
      <KanbanAddTaskSidebar />
      <KanbanUpdateTaskSidebar />
      <KanbanAddColumnSidebar />
      <KanbanUpdateColumnSidebar />
    </KanbanProvider>
  );
}
