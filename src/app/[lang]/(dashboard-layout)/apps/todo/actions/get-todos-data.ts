import { toDosData } from "../_data/todos";

import type { ToDoType } from "../types";

export async function getTodosdata(): Promise<ToDoType[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(toDosData);
    }, 250);
  });
}
