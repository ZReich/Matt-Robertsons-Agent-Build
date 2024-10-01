import type { KanbanState, ColumnType, KanbanAction, TaskType } from "../types";

export const KanbanReducer = (
  state: KanbanState,
  action: KanbanAction
): KanbanState => {
  switch (action.type) {
    case "addColumn": {
      const newColumn: ColumnType = {
        ...action.column,
        id: `column-${state.columns.length}`,
        order: state.columns.length,
        tasks: [],
      };
      return { ...state, columns: [...state.columns, newColumn] };
    }

    case "updateColumn": {
      return {
        ...state,
        columns: state.columns.map((column) =>
          column.id === action.column.id ? { ...action.column } : column
        ),
      };
    }

    case "deleteColumn": {
      return {
        ...state,
        columns: state.columns.filter(
          (column) => column.id !== action.columnId
        ),
      };
    }

    case "addTask": {
      const totalTasksCount = state.columns.reduce(
        (count, column) => count + column.tasks.length,
        0
      );

      return {
        ...state,
        columns: state.columns.map((column) => {
          if (column.id === action.columnId) {
            const newTask = {
              ...action.task,
              id: `task-${totalTasksCount}`,
              column_id: action.columnId,
              order: column.tasks.length,
            };
            return {
              ...column,
              tasks: [...column.tasks, newTask],
            };
          }
          return column;
        }),
      };
    }

    case "updateTask": {
      return {
        ...state,
        columns: state.columns.map((column) => {
          const updatedTasks = column.tasks.map((task) =>
            task.id === action.task.id
              ? { ...action.task, column_id: column.id }
              : task
          );
          return { ...column, tasks: updatedTasks };
        }),
      };
    }

    case "deleteTask": {
      return {
        ...state,
        columns: state.columns.map((column) => {
          const updatedTasks = column.tasks.filter(
            (task) => task.id !== action.taskId
          );
          return { ...column, tasks: updatedTasks };
        }),
      };
    }

    case "reorderColumns": {
      const { sourceIndex, destinationIndex } = action;
      const reorderedColumns = [...state.columns];
      const [movedColumn] = reorderedColumns.splice(sourceIndex, 1);
      reorderedColumns.splice(destinationIndex, 0, movedColumn);

      return {
        ...state,
        columns: reorderedColumns.map((column, index) => ({
          ...column,
          order: index,
        })),
      };
    }

    case "reorderTasks": {
      const { source, destination } = action;

      // If the task is moved within the same column
      if (source.columnId === destination.columnId) {
        return {
          ...state,
          columns: state.columns.map((column) => {
            if (column.id === source.columnId) {
              const updatedTasks = [...column.tasks];
              const [movedTask] = updatedTasks.splice(source.index, 1);
              updatedTasks.splice(destination.index, 0, movedTask);

              // Update order for tasks in this column
              return {
                ...column,
                tasks: updatedTasks.map((task, index) => ({
                  ...task,
                  order: index, // Set the order based on the new index
                })),
              };
            }
            return column;
          }),
        };
      } else {
        // If the task is moved to a different column
        let movedTask: TaskType | undefined;

        // Update source column to remove the moved task
        const updatedState = {
          ...state,
          columns: state.columns.map((column) => {
            if (column.id === source.columnId) {
              const updatedSourceTasks = [...column.tasks];
              [movedTask] = updatedSourceTasks.splice(source.index, 1);
              return { ...column, tasks: updatedSourceTasks };
            }
            return column;
          }),
        };

        // Update destination column to add the moved task
        return {
          ...updatedState,
          columns: updatedState.columns.map((column) => {
            if (column.id === destination.columnId && movedTask) {
              const updatedDestinationTasks = [...column.tasks];
              const movedTaskWithUpdatedColumnId = {
                ...movedTask,
                column_id: destination.columnId,
                order: updatedDestinationTasks.length, // Set order based on new position
              };
              updatedDestinationTasks.splice(
                destination.index,
                0,
                movedTaskWithUpdatedColumnId
              );

              // Update order for all tasks in this column
              return {
                ...column,
                tasks: updatedDestinationTasks.map((task, index) => ({
                  ...task,
                  order: index, // Set the order based on the new index
                })),
              };
            }
            return column;
          }),
        };
      }
    }

    case "selectColumn": {
      return { ...state, selectedColumn: action.column };
    }

    case "selectTask": {
      return { ...state, selectedTask: action.task };
    }

    default:
      return state;
  }
};
