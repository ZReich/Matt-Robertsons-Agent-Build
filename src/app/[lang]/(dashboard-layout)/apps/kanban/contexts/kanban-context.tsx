"use client";

import * as React from "react";

import { KanbanReducer } from "../reducers/kanban-reducer";

import type {
  ColumnType,
  ColumnWithoutIdAndOrderAndTasksType,
  KanbanContextType,
  TaskType,
  TaskWithoutIdAndOrderAndColumnIdType,
} from "../types";

export const KanbanContext = React.createContext<KanbanContextType | undefined>(
  undefined
);

interface KanbanProviderProps {
  kanbanData: ColumnType[];
  children: React.ReactNode;
}

export function KanbanProvider({ kanbanData, children }: KanbanProviderProps) {
  const [kanbanState, dispatch] = React.useReducer(KanbanReducer, {
    columns: kanbanData,
    selectedColumn: undefined,
    selectedTask: undefined,
  });
  const [kanbanAddTaskSidebarIsOpen, setKanbanAddTaskSidebarIsOpen] =
    React.useState(false);
  const [kanbanUpdateTaskSidebarIsOpen, setKanbanUpdateTaskSidebarIsOpen] =
    React.useState(false);
  const [kanbanAddColumnSidebarIsOpen, setKanbanAddColumnSidebarIsOpen] =
    React.useState(false);
  const [kanbanUpdateColumnSidebarIsOpen, setKanbanUpdateColumnSidebarIsOpen] =
    React.useState(false);

  const handleAddColumn = (column: ColumnWithoutIdAndOrderAndTasksType) => {
    dispatch({ type: "addColumn", column });
  };

  const handleUpdateColumn = (column: ColumnType) => {
    dispatch({ type: "updateColumn", column });
  };

  const handleDeleteColumn = (columnId: ColumnType["id"]) => {
    dispatch({ type: "deleteColumn", columnId });
  };

  const handleAddTask = (
    task: TaskWithoutIdAndOrderAndColumnIdType,
    columnId: ColumnType["id"]
  ) => {
    dispatch({ type: "addTask", task, columnId });
  };

  const handleUpdateTask = (task: TaskType) => {
    dispatch({ type: "updateTask", task });
  };

  const handleDeleteTask = (taskId: TaskType["id"]) => {
    dispatch({ type: "deleteTask", taskId });
  };

  const handleReorderColumns = (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    if (sourceIndex === destinationIndex) return;

    dispatch({
      type: "reorderColumns",
      sourceIndex,
      destinationIndex,
    });
  };

  const handleReorderTasks = (
    sourceColumnId: string,
    sourceIndex: number,
    destinationColumnId: string,
    destinationIndex: number
  ) => {
    if (
      sourceColumnId === destinationColumnId &&
      sourceIndex === destinationIndex
    )
      return;

    dispatch({
      type: "reorderTasks",
      source: { columnId: sourceColumnId, index: sourceIndex },
      destination: { columnId: destinationColumnId, index: destinationIndex },
    });
  };

  const handleSelectColumn = (column: ColumnType | undefined) => {
    dispatch({ type: "selectColumn", column });
  };

  const handleSelectTask = (task: TaskType | undefined) => {
    dispatch({ type: "selectTask", task });
  };

  return (
    <KanbanContext.Provider
      value={{
        kanbanState,
        kanbanAddTaskSidebarIsOpen,
        setKanbanAddTaskSidebarIsOpen,
        kanbanUpdateTaskSidebarIsOpen,
        setKanbanUpdateTaskSidebarIsOpen,
        kanbanAddColumnSidebarIsOpen,
        setKanbanAddColumnSidebarIsOpen,
        kanbanUpdateColumnSidebarIsOpen,
        setKanbanUpdateColumnSidebarIsOpen,
        handleAddColumn,
        handleUpdateColumn,
        handleDeleteColumn,
        handleAddTask,
        handleUpdateTask,
        handleDeleteTask,
        handleReorderColumns,
        handleReorderTasks,
        handleSelectColumn,
        handleSelectTask,
      }}
    >
      {children}
    </KanbanContext.Provider>
  );
}
