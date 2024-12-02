"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

import { INITIAL_VIEW } from "../constants";

import type { DateInput, EventSourceInput } from "@fullcalendar/core/index.js";
import type { EventImpl } from "@fullcalendar/core/internal";
import type { CategoryType, EventType } from "../types";

import { Card } from "@/components/ui/card";
import { CalendarHeader } from "./calendar-header";
import { useCalendarContext } from "../hooks/calendar-context";

const eventColors: Record<CategoryType, string> = {
  Business: "hsl(var(--chart-1))",
  Personal: "hsl(var(--chart-2))",
  Family: "hsl(var(--chart-3))",
  Holiday: "hsl(var(--chart-4))",
  Health: "hsl(var(--chart-5))",
  Miscellaneous: "hsl(var(--primary))",
};

export function Calendar() {
  const {
    calendarState,
    calendarApi,
    setCalendarApi,
    handleSelectEvent,
    handleUpdateEvent,
    setEventSidebarIsOpen,
  } = useCalendarContext();
  const calendarRef = React.useRef<null | FullCalendar>(null);

  React.useEffect(() => {
    if (!calendarApi && calendarRef.current) {
      setCalendarApi(calendarRef.current.getApi());
    }
  }, [calendarApi, setCalendarApi]);

  const handleDateClick = (date: DateInput) => {
    if (calendarApi) {
      calendarApi.changeView("timeGridDay", date);
    }
  };
  const parseEvent = (event: EventImpl): EventType => {
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
    <Card>
      <CalendarHeader />
      <FullCalendar
        ref={calendarRef}
        initialView={INITIAL_VIEW}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        eventDisplay="block"
        events={calendarState.events.map(
          (event: EventType): EventSourceInput[] => ({
            ...event,
            // @ts-ignore
            color: eventColors[event.extendedProps.category],
          })
        )}
        eventClassNames={() => [
          "h-[1.62rem] pt-px px-1 rounded-md",
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
    </Card>
  );
}
