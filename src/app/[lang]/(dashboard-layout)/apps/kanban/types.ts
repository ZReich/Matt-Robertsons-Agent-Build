export interface UserType {
  id: string;
  username: string;
  name: string;
  avatar?: string;
}

export interface FileType {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface CommentType {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
}

export interface TaskType {
  id: string;
  columnId: string;
  order: number;
  title: string;
  description?: string;
  label: string;
  comments: CommentType[];
  assigned: UserType[];
  dueDate: Date;
  attachments: FileType[];
}

export interface ColumnType {
  id: string;
  order: number;
  title: string;
  tasks: TaskType[];
}

export type ColumnWithoutIdAndOrderAndTasksType = Omit<
  ColumnType,
  "id" | "order" | "tasks"
>;

export type TaskWithoutIdAndOrderAndColumnIdType = Omit<
  TaskType,
  "id" | "order" | "columnId"
>;

export interface KanbanStateType {
  columns: ColumnType[];
  initialTeamMembers: UserType[];
  selectedColumn?: ColumnType;
  selectedTask?: TaskType;
  selectedTeamMembers: UserType[];
}

export interface LabelType {
  id: string;
  name: string;
}

export type KanbanActionType =
  | { type: "addColumn"; column: ColumnWithoutIdAndOrderAndTasksType }
  | { type: "updateColumn"; column: ColumnType }
  | { type: "deleteColumn"; columnId: string }
  | {
      type: "addTask";
      task: TaskWithoutIdAndOrderAndColumnIdType;
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
  | { type: "selectTask"; task?: TaskType }
  | { type: "getTeamMembersBySearchTerm"; term: string };

export interface KanbanContextType {
  kanbanState: KanbanStateType;
  kanbanAddTaskSidebarIsOpen: boolean;
  setKanbanAddTaskSidebarIsOpen: (value: boolean) => void;
  kanbanUpdateTaskSidebarIsOpen: boolean;
  setKanbanUpdateTaskSidebarIsOpen: (value: boolean) => void;
  kanbanAddColumnSidebarIsOpen: boolean;
  setKanbanAddColumnSidebarIsOpen: (value: boolean) => void;
  kanbanUpdateColumnSidebarIsOpen: boolean;
  setKanbanUpdateColumnSidebarIsOpen: (value: boolean) => void;
  handleAddColumn: (column: ColumnWithoutIdAndOrderAndTasksType) => void;
  handleUpdateColumn: (column: ColumnType) => void;
  handleDeleteColumn: (columnId: ColumnType["id"]) => void;
  handleAddTask: (
    task: TaskWithoutIdAndOrderAndColumnIdType,
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
  handleGetTeamMembersBySearchTerm: (term: string) => void;
}
