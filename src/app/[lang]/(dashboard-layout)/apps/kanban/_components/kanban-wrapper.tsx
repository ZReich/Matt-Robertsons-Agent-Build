import { KanbanProvider } from "../contexts/kanban-context";

import type { ColumnType } from "../types";

import { KanbanSidebar } from "./kanban-sidebar";

export function KanbanWrapper({
  kanbanData,
  children,
}: {
  kanbanData: ColumnType[];
  children: React.ReactNode;
}) {
  return (
    <KanbanProvider kanbanData={kanbanData}>
      <KanbanSidebar />
      {children}
    </KanbanProvider>
  );
}
