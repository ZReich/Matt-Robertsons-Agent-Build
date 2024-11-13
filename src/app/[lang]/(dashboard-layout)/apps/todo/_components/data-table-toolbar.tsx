"use client";

import { X } from "lucide-react";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

import type { ToDoType } from "../types";

import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableAddSidebar } from "./data-table-add-sidebar";
import { statusesData } from "../_data/statuses";
import { prioritiesData } from "../_data/priorities";

interface DataTableToolbarProps<TTable> {
  table: Table<TTable>;
  toDos: ToDoType[];
  setToDos: (value: ToDoType[]) => void;
}

export function DataTableToolbar<TTable>({
  table,
  toDos,
  setToDos,
}: DataTableToolbarProps<TTable>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex flex-col gap-4 py-4 md:flex-row">
      <Input
        placeholder="Search todos..."
        value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
        onChange={(event) =>
          table.getColumn("title")?.setFilterValue(event.target.value)
        }
        className="h-8 max-w-xs"
      />
      <div className="flex items-center gap-2">
        <DataTableAddSidebar toDos={toDos} setToDos={setToDos} />
        <DataTableViewOptions table={table} />
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statusesData}
          />
        )}
        {table.getColumn("priority") && (
          <DataTableFacetedFilter
            column={table.getColumn("priority")}
            title="Priority"
            options={prioritiesData}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 md:px-3"
          >
            Reset
            <X className="ms-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
