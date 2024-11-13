export interface UserType {
  id: string;
  username: string;
  full_name: string;
  avatar: string;
}

export interface FileType {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface CommentType {
  id: string;
  user_id: string;
  text: string;
  created_at: Date;
}

export interface TaskType {
  id: string;
  column_id: string;
  order: number;
  title: string;
  description?: string;
  label: string;
  comments: CommentType[];
  assigned: UserType[];
  due_date: Date;
  attachments: FileType[];
}

export interface ColumnType {
  id: string;
  order: number;
  title: string;
  tasks: TaskType[];
}

export interface KanbanState {
  columns: ColumnType[];
  selectedColumn?: ColumnType;
  selectedTask?: TaskType;
}

export interface Label {
  id: string;
  name: string;
}

export type KanbanAction =
  | { type: "addColumn"; column: Omit<ColumnType, "id" | "order" | "tasks"> }
  | { type: "updateColumn"; column: ColumnType }
  | { type: "deleteColumn"; columnId: string }
  | {
      type: "addTask";
      task: Omit<TaskType, "id" | "order" | "column_id">;
      columnId: string;
    }
  | { type: "updateTask"; task: TaskType }
  | { type: "deleteTask"; taskId: string }
  | { type: "reorderColumns"; sourceIndex: number; destinationIndex: number }
  | {
      type: "reorderTasks";
      source: { columnId: string; index: number };
      destination: { columnId: string; index: number };
    }
  | { type: "selectColumn"; column?: ColumnType }
  | { type: "selectTask"; task?: TaskType };

export interface KanbanContextType {
  kanbanState: KanbanState;
  kanbanAddTaskSidebarIsOpen: boolean;
  setKanbanAddTaskSidebarIsOpen: (value: boolean) => void;
  kanbanUpdateTaskSidebarIsOpen: boolean;
  setKanbanUpdateTaskSidebarIsOpen: (value: boolean) => void;
  kanbanAddColumnSidebarIsOpen: boolean;
  setKanbanAddColumnSidebarIsOpen: (value: boolean) => void;
  kanbanUpdateColumnSidebarIsOpen: boolean;
  setKanbanUpdateColumnSidebarIsOpen: (value: boolean) => void;
  handleAddColumn: (column: Omit<ColumnType, "id" | "order" | "tasks">) => void;
  handleUpdateColumn: (column: ColumnType) => void;
  handleDeleteColumn: (columnId: ColumnType["id"]) => void;
  handleAddTask: (
    task: Omit<TaskType, "id" | "order" | "column_id">,
    columnId: ColumnType["id"]
  ) => void;
  handleUpdateTask: (task: TaskType) => void;
  handleDeleteTask: (taskId: TaskType["id"]) => void;
  handleReorderColumns: (sourceIndex: number, destinationIndex: number) => void;
  handleReorderTasks: (
    sourceColumnId: string,
    sourceIndex: number,
    destinationColumnId: string,
    destinationIndex: number
  ) => void;
  handleSelectColumn: (column: ColumnType | undefined) => void;
  handleSelectTask: (task: TaskType | undefined) => void;
}
