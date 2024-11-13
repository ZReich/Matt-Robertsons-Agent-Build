export interface ToDoType {
  id: string;
  title: string;
  description?: string;
  label?: string;
  status: "backlog" | "todo" | "in progress" | "done" | "canceled";
  priority: "low" | "medium" | "high";
  due_date?: Date;
  created_at: Date;
  updated_at: Date;
}
