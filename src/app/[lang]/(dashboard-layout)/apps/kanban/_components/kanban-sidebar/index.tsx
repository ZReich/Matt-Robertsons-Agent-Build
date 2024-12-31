import { KanbanAddTaskSidebar } from "./kanban-add-task-sidebar";
import { KanbanUpdateTaskSidebar } from "./kanban-update-task-sidebar";
import { KanbanAddColumnSidebar } from "./kanban-add-column-sidebar";
import { KanbanUpdateColumnSidebar } from "./kanban-update-column-sidebar";

export function KanbanSidebar() {
  return (
    <>
      <KanbanAddTaskSidebar />
      <KanbanUpdateTaskSidebar />
      <KanbanAddColumnSidebar />
      <KanbanUpdateColumnSidebar />
    </>
  );
}
