"use client"

import { useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Grid2x2Plus } from "lucide-react"

import type { KanbanTaskFormType } from "../../types"

import { labelsData } from "../../_data/labels"

import { KanbanTaskSchema } from "../../_schemas/kanban-task-schema"

import { useKanbanContext } from "../../_hooks/use-kanban-context"
import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/components/ui/file-dropzone"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { InputTagsWithSuggestions } from "@/components/ui/input-tags"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/date-picker"

const defaultValues = {
  title: "",
  description: "",
  label: "Development",
  dueDate: new Date(),
  assigned: [],
  comments: [],
  attachments: [],
}

export function KanbanAddTaskSidebar() {
  const {
    kanbanState,
    kanbanAddTaskSidebarIsOpen,
    setKanbanAddTaskSidebarIsOpen,
    handleAddTask,
    handleSelectTask,
  } = useKanbanContext()

  const form = useForm<KanbanTaskFormType>({
    resolver: zodResolver(KanbanTaskSchema),
    defaultValues,
  })

  const { teamMembers, selectedColumn } = kanbanState

  function onSubmit(data: KanbanTaskFormType) {
    if (selectedColumn) {
      handleAddTask(data, selectedColumn.id)
    }

    handleSidebarClose()
  }

  const handleSidebarClose = () => {
    form.reset(defaultValues) // Reset the form to the initial values
    handleSelectTask(undefined) // Unselect the current task
    setKanbanAddTaskSidebarIsOpen(false) // Close the sidebar
  }

  const labelOptions = useMemo(
    () =>
      labelsData.map((label) => (
        <SelectItem key={label.id} value={label.name}>
          {label.name}
        </SelectItem>
      )),
    []
  )

  return (
    <Sheet
      open={kanbanAddTaskSidebarIsOpen}
      onOpenChange={() => handleSidebarClose()}
    >
      <SheetContent className="p-0" side="end">
        <ScrollArea className="h-full p-4">
          <SheetHeader>
            <SheetTitle>Add New Task</SheetTitle>
            <SheetDescription>
              Add a new task to the {selectedColumn?.title} column.
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
                      <SelectContent>{labelOptions}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigned"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Team Members</FormLabel>
                    <InputTagsWithSuggestions
                      suggestions={teamMembers.map(({ name }) => name)}
                      tags={field.value.map(({ name }) => name)}
                      onTagsChange={(tags) =>
                        field.onChange(
                          teamMembers.filter((member) =>
                            tags.includes(member.name)
                          )
                        )
                      }
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <DatePicker
                      formatStr="PPP"
                      onValueChange={field.onChange}
                      {...field}
                    />
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
              <FormField
                control={form.control}
                name="attachments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attachments</FormLabel>
                    <FormControl>
                      <FileDropzone
                        multiple
                        onFilesChange={field.onChange}
                        {...field}
                      />
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
  )
}
