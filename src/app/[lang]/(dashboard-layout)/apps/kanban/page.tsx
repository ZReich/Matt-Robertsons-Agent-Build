import { kanbanData } from "./_data/kanban";

import { KanbanProvider } from "./contexts/kanban-context";

import type { Metadata } from "next";

import { Kanban } from "./_components/kanban";
import { KanbanAddTaskSidebar } from "./_components/kanban-add-task-sidebar";
import { KanbanUpdateTaskSidebar } from "./_components/kanban-update-task-sidebar";
import { KanbanAddColumnSidebar } from "./_components/kanban-add-column-sidebar";
import { KanbanUpdateColumnSidebar } from "./_components/kanban-update-column-sidebar";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Kanban",
};

export default async function KanbanPage() {
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
