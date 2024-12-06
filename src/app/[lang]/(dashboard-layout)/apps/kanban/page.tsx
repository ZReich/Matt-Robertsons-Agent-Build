import { getKanbanData } from "./_actions/get-kanban-data";

import { KanbanProvider } from "./contexts/kanban-context";

import type { Metadata } from "next";
import type { ColumnType } from "./types";

import { Kanban } from "./_components/kanban";
import { KanbanAddTaskSidebar } from "./_components/kanban-add-task-sidebar";
import { KanbanUpdateTaskSidebar } from "./_components/kanban-update-task-sidebar";
import { KanbanAddColumnSidebar } from "./_components/kanban-add-column-sidebar";
import { KanbanUpdateColumnSidebar } from "./_components/kanban-update-column-sidebar";

export const metadata: Metadata = {
  title: "Kanban",
};

export default async function KanbanPage() {
  const kanbanData: ColumnType[] = await getKanbanData();

  return (
    <KanbanProvider kanbanData={kanbanData}>
      <Kanban />
      <KanbanAddTaskSidebar />
      <KanbanUpdateTaskSidebar />
      <KanbanAddColumnSidebar />
      <KanbanUpdateColumnSidebar />
    </KanbanProvider>
  );
}
