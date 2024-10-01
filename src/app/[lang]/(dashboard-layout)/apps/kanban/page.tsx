import { getKanbanData } from "./_actions/get-kanban-data";
import { getTeamMembersData } from "./_actions/get-team-members-data ";

import { KanbanProvider } from "./contexts/kanban-context";

import type { ColumnType, MemberType } from "./types";

import { Kanban } from "./_components/kanban";
import { KanbanAddTaskSidebar } from "./_components/kanban-add-task-sidebar";
import { KanbanUpdateTaskSidebar } from "./_components/kanban-update-task-sidebar";
import { KanbanAddColumnSidebar } from "./_components/kanban-add-column-sidebar";
import { KanbanUpdateColumnSidebar } from "./_components/kanban-update-column-sidebar";

export const labels = [
  { id: "research", name: "Research" },
  { id: "design", name: "Design" },
  { id: "development", name: "Development" },
  { id: "meeting", name: "Meeting" },
  { id: "documentation", name: "Documentation" },
  { id: "qa", name: "QA" },
  { id: "marketing", name: "Marketing" },
] as const;

export default async function KanbanPage() {
  const kanbanData: ColumnType[] = await getKanbanData();
  const teamMembersData: MemberType[] = await getTeamMembersData();

  return (
    <KanbanProvider kanbanData={kanbanData} teamMembersData={teamMembersData}>
      <Kanban />
      <KanbanAddTaskSidebar />
      <KanbanUpdateTaskSidebar />
      <KanbanAddColumnSidebar />
      <KanbanUpdateColumnSidebar />
    </KanbanProvider>
  );
}
