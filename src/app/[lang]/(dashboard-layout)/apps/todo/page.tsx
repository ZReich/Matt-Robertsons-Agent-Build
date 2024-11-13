import { getTodosdata } from "./actions/get-todos-data";

import type { ToDoType } from "./types";

import { columns } from "./_components/columns";
import { DataTable } from "./_components/data-table";

export default async function ToDoPage() {
  const toDos: ToDoType[] = await getTodosdata();

  return <DataTable columns={columns} toDos={toDos} />;
}
