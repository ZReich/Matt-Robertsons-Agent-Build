"use client";

import { forwardRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import {
  CalendarApi,
  DateInput,
  EventSourceInput,
} from "@fullcalendar/core/index.js";
import { EventImpl } from "@fullcalendar/core/internal";

import { initialView } from "@/constants";

import { Category, CalendarState, Event } from "@/types";

import { Card } from "@/components/ui/card";
import { CalendarHeader } from "./calendar-header";

const getEventColor = (category: Category) => {
  switch (category) {
    case "Business":
      return "hsl(var(--chart-1))";
    case "Personal":
      return "hsl(var(--chart-2))";
    case "Family":
      return "hsl(var(--chart-3))";
    case "Holiday":
      return "hsl(var(--chart-4))";
    case "Health":
      return "hsl(var(--chart-5))";
    case "Miscellaneous":
      return "hsl(var(--primary))";
    default:
      return "hsl(var(--primary))";
  }
};

type CalendarProps = {
  calendarState: CalendarState;
  calendarApi: CalendarApi | null;
  setCalendarApi: (calendarApi: CalendarApi) => void;
  handleSelectEvent: (event: Event) => void;
  handleUpdateEvent: (event: Event) => void;
  handleSelectCategory: (category: Category) => void;
  handleSelectAllCategories: (isSelectAll: boolean) => void;
  setEventSidebarIsOpen: (value: boolean) => void;
};

export const Calendar = forwardRef<FullCalendar, CalendarProps>(
  (
    {
      calendarState,
      calendarApi,
      handleSelectEvent,
      handleUpdateEvent,
      handleSelectCategory,
      handleSelectAllCategories,
      setEventSidebarIsOpen,
    },
    ref
  ) => {
    const handleDateClick = (date: DateInput) => {
      if (calendarApi) {
        calendarApi.changeView("timeGridDay", date);
      }
    };
    const parseEvent = (event: EventImpl): Event => {
      return {
        id: event.id,
        ...(event.url && { url: event.url }),
        title: event.title,
        allDay: event.allDay,
        start: event.start,
        end: event.end,
        extendedProps: {
          category: event.extendedProps.category,
          ...(event.extendedProps.description && {
            description: event.extendedProps.description,
          }),
        },
      };
    };

    return (
      <Card className="p-4">
        <CalendarHeader
          calendarApi={calendarApi}
          setEventSidebarIsOpen={setEventSidebarIsOpen}
          handleSelectCategory={handleSelectCategory}
          handleSelectAllCategories={handleSelectAllCategories}
          calendarState={calendarState}
        />
        <div className="bg-background rounded-lg shadow [&_div_>_div_table]:rounded-lg [&_div_>_div_table]:overflow-hidden">
          <FullCalendar
            ref={ref}
            initialView={initialView}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              listPlugin,
            ]}
            eventDisplay="block"
            height="auto"
            events={calendarState.events.map(
              (event: Event): EventSourceInput[] => ({
                ...event,
                // @ts-ignore
                color: getEventColor(event.extendedProps.category),
              })
            )}
            eventClassNames={() => [
              "h-[1.62rem] pt-px rounded-md",
              "[&_td]:hover:!bg-accent/60",
            ]}
            headerToolbar={false}
            editable
            eventResizableFromStart
            dragScroll
            dayMaxEvents={2}
            navLinks
            navLinkDayClick={handleDateClick}
            eventDrop={({ event }) => handleUpdateEvent(parseEvent(event))}
            eventResize={({ event }) => handleUpdateEvent(parseEvent(event))}
            eventClick={({ event, jsEvent }) => {
              jsEvent.preventDefault();
              if (event.url) {
                window.open(event.url, "_blank");
              }

              handleSelectEvent(parseEvent(event));
              setEventSidebarIsOpen(true);
            }}
          />
        </div>
      </Card>
    );
  }
);
Calendar.displayName = "Calendar";
