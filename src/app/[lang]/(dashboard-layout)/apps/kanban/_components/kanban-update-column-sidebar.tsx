"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Grid2x2Plus } from "lucide-react";

import { KanbanColumnSchema } from "../_schemas/kanban-column-schema";

import { useKanbanContext } from "../hooks/use-kanban-context";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

type FormValues = z.infer<typeof KanbanColumnSchema>;

export function KanbanUpdateColumnSidebar() {
  const {
    kanbanState,
    kanbanUpdateColumnSidebarIsOpen,
    setKanbanUpdateColumnSidebarIsOpen,
    handleUpdateColumn,
    handleSelectColumn,
  } = useKanbanContext();

  const form = useForm<FormValues>({
    resolver: zodResolver(KanbanColumnSchema),
  });

  const selectedColumn = kanbanState.selectedColumn;

  // Reset the form with the current selected column's values whenever `selectedColumn` changes
  React.useEffect(() => {
    if (selectedColumn) {
      form.reset({
        title: selectedColumn?.title,
      });
    }
  }, [selectedColumn, form]);

  function onSubmit(data: FormValues) {
    if (selectedColumn) {
      handleUpdateColumn({
        title: data.title,
        id: selectedColumn.id,
        order: selectedColumn.order,
        tasks: selectedColumn.tasks,
      });
    }

    handleSidebarClose();
  }

  const handleSidebarClose = () => {
    form.reset(); // Reset the form to the initial values
    handleSelectColumn(undefined); // Unselect the current column
    setKanbanUpdateColumnSidebarIsOpen(false); // Close the sidebar
  };

  return (
    <Sheet
      open={kanbanUpdateColumnSidebarIsOpen}
      onOpenChange={() => handleSidebarClose()}
    >
      <SheetContent className="p-0" side="end">
        <ScrollArea className="h-full p-4">
          <SheetHeader>
            <SheetTitle>Update Column</SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 mt-4"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Column title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                <Grid2x2Plus className="me-1 size-4" />
                Save
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
