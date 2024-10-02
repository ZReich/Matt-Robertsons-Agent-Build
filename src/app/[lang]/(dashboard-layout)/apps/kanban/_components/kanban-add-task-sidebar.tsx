"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Grid2x2Plus,
  Calendar as CalendarIcon,
  X,
  Paperclip,
  Loader2,
} from "lucide-react";

import { labels } from "../page";
import { getTeamMembersSearchData } from "../_actions/get-team-members-search-data";

import { cn } from "@/lib/utils";

import { useKanbanContext } from "../hooks/use-kanban-context";
import { useActionState } from "@/hooks/use-action-state";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormDescription,
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const CommentSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  text: z
    .string()
    .min(2, { message: "Comment must be at least 2 characters." }),
  created_at: z.date(),
});

const FileSchema = z.object({
  url: z.string(),
  name: z.string(),
  size: z.number().max(50 * 1024 * 1024, {
    message: "File size must be less than or equal to 50 MB.",
  }),
  type: z.string(),
});

const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  full_name: z.string(),
  avatar: z.string(),
});

const FormSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters." }),
  description: z.string().optional(),
  label: z.custom<string>(
    (value) => labels.some((label) => label.name === value),
    { message: "Invalid label. Please select a valid label." }
  ),
  assigned: z
    .array(UserSchema)
    .min(1, { message: "At least one user must be assigned." }),
  comments: z.array(CommentSchema),
  due_date: z.date({
    required_error: "Due date is required.",
    invalid_type_error: "Invalid due date. Please provide a valid date.",
  }),
  attachments: z
    .array(FileSchema)
    .max(10, { message: "You can attach a maximum of 10 files." }),
});

type FormValues = z.infer<typeof FormSchema>;
type TeamMemberType = z.infer<typeof UserSchema>;

export function KanbanAddTaskSidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTeamMembers, setSearchTeamMembers] = useState("");
  const [
    searchTeamMembersResults,
    searchTeamMembersAction,
    searchTeamMembersIsPending,
  ] = useActionState<string, TeamMemberType[]>(getTeamMembersSearchData, []);
  const {
    kanbanState,
    kanbanAddTaskSidebarIsOpen,
    setKanbanAddTaskSidebarIsOpen,
    handleAddTask,
    handleSelectTask,
  } = useKanbanContext();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      label: "Development",
      due_date: new Date(),
      assigned: [],
      comments: [],
      attachments: [],
    },
  });

  const attachments = form.watch("attachments");
  const assigned = form.watch("assigned");
  const selectedColumn = kanbanState.selectedColumn;
  const assignedIds = new Set(assigned?.map((m) => m.id));

  function onSubmit(data: FormValues) {
    if (selectedColumn) {
      handleAddTask(data, selectedColumn.id);
    }

    handleSidebarClose();
  }

  const handleSidebarClose = () => {
    form.reset();
    form.clearErrors();
    setSearchTeamMembers("");
    handleSelectTask(undefined);
    setKanbanAddTaskSidebarIsOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Generate object URLs for each file
    const newAttachments = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    form.setValue("attachments", [...attachments, ...newAttachments]);
  };

  const handleFileRemove = (index: number) => {
    // Revoke the object URL
    URL.revokeObjectURL(attachments[index].url);

    // Update form values accordingly
    form.setValue(
      "attachments",
      attachments
        .filter((_, i) => i !== index)
        .map((attachment) => ({
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          url: attachment.url,
        }))
    );
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Sheet
      open={kanbanAddTaskSidebarIsOpen}
      onOpenChange={() => handleSidebarClose()}
    >
      <SheetContent className="p-0">
        <ScrollArea className="h-full p-4">
          <SheetHeader>
            <SheetTitle>Add New Task</SheetTitle>
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
                        {labels.map((label) => (
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
              <FormField
                control={form.control}
                name="assigned"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Team Members</FormLabel>
                    <FormControl>
                      <div>
                        <Command className="rounded-md border">
                          <CommandInput
                            className="h-9"
                            placeholder="Search team members..."
                            value={searchTeamMembers}
                            onValueChange={(value) => {
                              setSearchTeamMembers(value);
                              searchTeamMembersAction(value);
                            }}
                          />
                          <CommandList
                            aria-hidden={!!searchTeamMembers}
                            className={cn(
                              !!searchTeamMembers ? "block" : "hidden"
                            )}
                          >
                            {searchTeamMembersIsPending ? (
                              <div className="flex justify-center items-center py-6">
                                <Loader2 className="size-4  text-muted-foreground animate-spin" />
                              </div>
                            ) : (
                              <CommandEmpty>
                                No team members found.
                              </CommandEmpty>
                            )}
                            <CommandGroup>
                              {!searchTeamMembersIsPending &&
                                searchTeamMembersResults
                                  .filter(
                                    (member) => !assignedIds.has(member.id)
                                  )
                                  .map((user) => (
                                    <CommandItem
                                      key={user.id}
                                      onSelect={() => {
                                        field.onChange([...field.value, user]);
                                        setSearchTeamMembers("");
                                      }}
                                    >
                                      {user.full_name}
                                    </CommandItem>
                                  ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {field.value.map((user) => {
                            return (
                              user && (
                                <Badge
                                  key={user.id}
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                >
                                  {user.full_name}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-fit"
                                    onClick={() =>
                                      field.onChange(
                                        field.value.filter(
                                          (m) => m.id !== user.id
                                        )
                                      )
                                    }
                                  >
                                    <X className="size-3" />
                                    <span className="sr-only">Remove</span>
                                  </Button>
                                </Badge>
                              )
                            );
                          })}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="due_date"
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
                              format(field.value, "PPP")
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
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
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
              <FormField
                control={form.control}
                name="attachments"
                render={() => (
                  <FormItem>
                    <FormLabel>Attachments</FormLabel>
                    <FormControl>
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleButtonClick}
                        >
                          <Paperclip className="me-2 size-4 text-muted-foreground" />
                          Select Attachments
                        </Button>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          className="sr-only"
                          multiple
                          onChange={handleFileChange}
                        />
                      </>
                    </FormControl>
                    <FormDescription>
                      {attachments.length} file(s) selected
                    </FormDescription>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((attachment, index) => (
                        <div key={attachment.url} className="size-fit relative">
                          {attachment.type.includes("image") ? (
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="size-20 mt-2 object-cover rounded-md"
                            />
                          ) : (
                            <div className="size-20 flex flex-col justify-center items-center p-2">
                              <span className="w-full text-xs truncate">
                                {attachment.name}
                              </span>
                            </div>
                          )}
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-3 end-1 size-4"
                            onClick={() => handleFileRemove(index)}
                          >
                            <X className="size-3" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      ))}
                    </div>
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
