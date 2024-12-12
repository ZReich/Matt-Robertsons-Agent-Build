"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarCheck2, CalendarIcon, CalendarMinus } from "lucide-react";

import { EventSidebarSchema } from "../_schemas/event-sidebar-schema";

import { cn, isBeforeToday } from "@/lib/utils";

import { useCalendarContext } from "../hooks/calendar-context";

import type { EventWithoutIdType } from "../types";

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

type FormValues = z.infer<typeof EventSidebarSchema>;

export function EventSidebar() {
  const {
    calendarState,
    calendarApi,
    handleAddEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleSelectEvent,
    eventSidebarIsOpen,
    setEventSidebarIsOpen,
  } = useCalendarContext();

  const form = useForm<FormValues>({
    resolver: zodResolver(EventSidebarSchema),
    defaultValues: {
      url: "",
      title: "",
      description: "",
      allDay: true,
      start: new Date(),
      end: new Date(),
      category: "Miscellaneous",
    },
  });

  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;
  const selectedEvent = calendarState.selectedEvent;

  // Reset the form with the current selected event's values if it exists; otherwise reset to the default state. This runs whenever `selectedEvent` or `eventSidebarIsOpen` changes
  React.useEffect(() => {
    if (selectedEvent) {
      const { extendedProps, ...eventProps } = selectedEvent;

      form.reset({
        ...eventProps,
        ...extendedProps,
      });
    } else {
      form.reset({
        url: "",
        title: "",
        description: "",
        allDay: true,
        start: new Date(),
        end: new Date(),
        category: "Miscellaneous",
      });
    }
  }, [eventSidebarIsOpen, selectedEvent, form]);

  const handleSidebarClose = () => {
    handleSelectEvent(undefined); // Unselect the current event
    setEventSidebarIsOpen(false); // Close the sidebar
  };

  function onSubmit(data: FormValues) {
    if (!calendarApi) return; // Ensure the calendar API is available before proceeding

    const event: EventWithoutIdType = {
      ...(data.url && { url: data.url }), // Optional URL
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
        id: selectedEvent.id, // Use the ID of the currently selected event
        ...event,
      });
    } else {
      handleAddEvent(event);
    }

    // Refresh the calendar and close the sidebar
    calendarApi.refetchEvents();
    handleSidebarClose();
  }

  function handleOnDeleteEvent() {
    if (!calendarApi) return; // Ensure the calendar API is available before proceeding

    // Check if an event is currently selected
    if (selectedEvent) {
      handleDeleteEvent(selectedEvent.id); // Delete the event

      // Refresh the calendar and close the sidebar
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
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={isBeforeToday}
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
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={isBeforeToday}
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
              <Button type="submit" className="w-full" disabled={isDisabled}>
                <CalendarCheck2 className="me-1 size-4" />
                Save
              </Button>
              {/* Display the delete button only when an event is selected to avoid showing it during event creation */}
              {selectedEvent && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleOnDeleteEvent}
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
