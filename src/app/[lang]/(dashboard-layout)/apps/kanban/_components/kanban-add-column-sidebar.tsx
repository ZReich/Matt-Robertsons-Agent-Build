"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Grid2x2Plus } from "lucide-react";

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

const FormSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
});

type FormValues = z.infer<typeof FormSchema>;

export function KanbanAddColumnSidebar() {
  const {
    kanbanAddColumnSidebarIsOpen,
    setKanbanAddColumnSidebarIsOpen,
    handleAddColumn,
  } = useKanbanContext();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    form.reset();
  }, [kanbanAddColumnSidebarIsOpen, form]);

  function onSubmit(data: FormValues) {
    handleAddColumn(data);

    handleSidebarClose();
  }

  const handleSidebarClose = () => {
    form.clearErrors();
    setKanbanAddColumnSidebarIsOpen(false);
  };

  return (
    <Sheet
      open={kanbanAddColumnSidebarIsOpen}
      onOpenChange={() => handleSidebarClose()}
    >
      <SheetContent className="p-0">
        <ScrollArea className="h-full p-4">
          <SheetHeader>
            <SheetTitle>Add New Column</SheetTitle>
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
                      <Input placeholder="Event title" {...field} />
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
