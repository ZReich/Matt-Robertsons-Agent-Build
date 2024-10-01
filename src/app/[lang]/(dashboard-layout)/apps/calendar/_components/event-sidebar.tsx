"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  CalendarCheck2,
  Calendar as CalendarIcon,
  CalendarMinus,
} from "lucide-react";
import { CalendarApi } from "@fullcalendar/core/index.js";

import { categories } from "../constants";

import { cn } from "@/lib/utils";

import type { CalendarState, Category, Event } from "../types";

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
import { Switch } from "@/components/ui/switch";
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

const FormSchema = z.object({
  url: z.string().url({ message: "Invalid url" }).optional().or(z.literal("")),
  title: z.string().min(1, { message: "Title is required" }),
  allDay: z.boolean(),
  description: z.string().optional(),
  start: z.date().nullable(),
  end: z.date().nullable(),
  category: z.custom<Category>(
    (value) => categories.some((category) => category === value),
    { message: "Invalid label" }
  ),
});

type FormValues = z.infer<typeof FormSchema>;

export type EventSidebarType = {
  calendarState: CalendarState;
  calendarApi: CalendarApi | null;
  handleAddEvent: (event: Omit<Event, "id">) => void;
  handleUpdateEvent: (event: Event) => void;
  handleDeleteEvent: (eventId: Event["id"]) => void;
  handleSelectEvent: (event: Event | undefined) => void;
  setEventSidebarIsOpen: (value: boolean) => void;
  eventSidebarIsOpen: boolean;
};

export function EventSidebar({
  calendarState,
  calendarApi,
  handleAddEvent,
  handleUpdateEvent,
  handleDeleteEvent,
  handleSelectEvent,
  eventSidebarIsOpen,
  setEventSidebarIsOpen,
}: EventSidebarType) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      allDay: true,
      start: new Date(),
      end: new Date(),
      category: "Miscellaneous",
    },
  });

  const selectedEvent = calendarState.selectedEvent;

  useEffect(() => {
    if (selectedEvent) {
      const { extendedProps, ...eventProps } = selectedEvent;

      form.reset({
        ...eventProps,
        ...extendedProps,
      });
    } else {
      form.reset({
        allDay: true,
        category: "Miscellaneous",
        start: new Date(),
        end: new Date(),
      });
    }
  }, [eventSidebarIsOpen, selectedEvent, form]);

  const handleSidebarClose = async () => {
    form.clearErrors();
    handleSelectEvent(undefined);
    setEventSidebarIsOpen(false);
  };

  function onSubmit(data: FormValues) {
    if (!calendarApi) return;

    const event: Omit<Event, "id"> = {
      ...(data.url && { url: data.url }),
      title: data.title,
      allDay: data.allDay,
      start: data.start,
      end: data.end,
      extendedProps: {
        description: data.description,
        category: data.category,
      },
    };

    if (selectedEvent) {
      handleUpdateEvent({
        id: selectedEvent.id,
        ...event,
      });
    } else {
      handleAddEvent(event);
    }

    calendarApi.refetchEvents();
    handleSidebarClose();
  }

  function handleDelete() {
    if (!calendarApi) return;

    if (selectedEvent) {
      handleDeleteEvent(selectedEvent.id);
      calendarApi.refetchEvents();
      handleSidebarClose();
    }
  }

  return (
    <Sheet open={eventSidebarIsOpen} onOpenChange={() => handleSidebarClose()}>
      <SheetContent className="p-0">
        <ScrollArea className="h-full p-4">
          <SheetHeader>
            <SheetTitle>
              {selectedEvent ? "Update Event" : "Add New Event"}
            </SheetTitle>
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
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Family">Family</SelectItem>
                        <SelectItem value="Holiday">Holiday</SelectItem>
                        <SelectItem value="Health">Health</SelectItem>
                        <SelectItem value="Miscellaneous">
                          Miscellaneous
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
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
                name="end"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
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
                name="allDay"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">All Day</FormLabel>
                      <FormDescription>
                        Is this an all-day event?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
              <Button type="submit" className="w-full">
                <CalendarCheck2 className="me-1 size-4" />
                Save
              </Button>
              {selectedEvent && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleDelete}
                >
                  <CalendarMinus className="me-1 size-4" />
                  Delete
                </Button>
              )}
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
