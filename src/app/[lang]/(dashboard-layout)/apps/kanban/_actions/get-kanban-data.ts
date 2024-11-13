import { kanbanData } from "../_data/kanban";

import type { ColumnType } from "../types";

export const getKanbanData = async (): Promise<ColumnType[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(kanbanData);
    }, 250);
  });
};
