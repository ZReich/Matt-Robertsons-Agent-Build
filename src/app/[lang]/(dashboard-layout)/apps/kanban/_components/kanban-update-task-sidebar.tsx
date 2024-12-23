"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Grid2x2Plus, CalendarIcon } from "lucide-react";

import { labelsData } from "../_data/labels";

import { KanbanTaskSchema } from "../_schemas/kanban-task-schema";

import { cn, formatDate, isBeforeToday } from "@/lib/utils";

import { useKanbanContext } from "../hooks/use-kanban-context";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssignedFormField } from "./assigned-form-field";
import { AttachmentsFormField } from "./attachments-form-field";

const defaultValues = {
  title: "",
  description: "",
  label: "Development",
  dueDate: new Date(),
  assigned: [],
  comments: [],
  attachments: [],
};

type FormType = z.infer<typeof KanbanTaskSchema>;

export function KanbanUpdateTaskSidebar() {
  const {
    kanbanState,
    kanbanUpdateTaskSidebarIsOpen,
    setKanbanUpdateTaskSidebarIsOpen,
    handleUpdateTask,
    handleSelectTask,
  } = useKanbanContext();

  const form = useForm<FormType>({
    resolver: zodResolver(KanbanTaskSchema),
    defaultValues,
  });

  const selectedTask = kanbanState.selectedTask;

  // Reset the form with the current selected task's values whenever `selectedTask` changes
  React.useEffect(() => {
    if (selectedTask) {
      form.reset({
        title: selectedTask?.title,
        description: selectedTask?.description,
        label: selectedTask?.label,
        assigned: selectedTask?.assigned || [],
        comments: selectedTask?.comments || [],
        dueDate: selectedTask?.dueDate,
        attachments: selectedTask?.attachments || [],
      });
    }
  }, [selectedTask, form]);

  function onSubmit(data: FormType) {
    if (selectedTask) {
      handleUpdateTask({
        ...data,
        id: selectedTask.id,
        columnId: selectedTask.columnId,
        order: selectedTask.order,
        comments: selectedTask.comments,
      });
    }

    handleSidebarClose();
  }

  const handleSidebarClose = () => {
    form.reset(defaultValues); // Reset the form to the initial values
    handleSelectTask(undefined); // Unselect the current task
    setKanbanUpdateTaskSidebarIsOpen(false); // Close the sidebar
  };

  return (
    <Sheet
      open={kanbanUpdateTaskSidebarIsOpen}
      onOpenChange={() => handleSidebarClose()}
    >
      <SheetContent className="p-0" side="end">
        <ScrollArea className="h-full p-4">
          <SheetHeader>
            <SheetTitle>Update Task</SheetTitle>
            <SheetDescription>
              Modify the details of the {selectedTask?.title} task.
            </SheetDescription>
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
                      <Input placeholder="Task title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a label" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {labelsData.map((label) => (
                          <SelectItem key={label.id} value={label.name}>
                            {label.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AssignedFormField form={form} />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              formatDate(field.value)
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) => isBeforeToday(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Event description"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AttachmentsFormField form={form} />
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
