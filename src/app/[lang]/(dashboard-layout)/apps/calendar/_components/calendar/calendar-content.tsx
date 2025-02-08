"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { useDirection } from "@radix-ui/react-direction";

import { INITIAL_VIEW } from "../../constants";

import type { DateInput, EventSourceInput } from "@fullcalendar/core/index.js";
import type { EventImpl } from "@fullcalendar/core/internal";
import type { CategoryType, EventType } from "../../types";

import { useCalendarContext } from "../../hooks/calendar-context";
import { useIsMobile } from "@/hooks/use-mobile";

// Map of category types to specific event colors for visual differentiation
const eventColors: Record<CategoryType, string> = {
  Business: "hsl(var(--chart-1))",
  Personal: "hsl(var(--chart-2))",
  Family: "hsl(var(--chart-3))",
  Holiday: "hsl(var(--chart-4))",
  Health: "hsl(var(--chart-5))",
  Miscellaneous: "hsl(var(--primary))",
};

export function CalendarContent() {
  const isMobile = useIsMobile();
  const direction = useDirection();
  // Destructure context values related to the calendar state and actions
  const {
    calendarState,
    calendarApi,
    setCalendarApi,
    handleSelectEvent,
    handleUpdateEvent,
    setEventSidebarIsOpen,
  } = useCalendarContext();

  // Create a reference to access the FullCalendar instance
  const calendarRef = React.useRef<null | FullCalendar>(null);

  // Initialize the calendar API when the component mounts or when `calendarApi` is not already set
  React.useEffect(() => {
    if (!calendarApi && calendarRef.current) {
      setCalendarApi(calendarRef.current.getApi());
    }
  }, [calendarApi, setCalendarApi]);

  // Function to parse and transform an event from FullCalendar's internal event representation to a structured format
  const parseEvent = (event: EventImpl): EventType => {
    return {
      id: event.id,
      ...(event.url && { url: event.url }), // Include URL property if it exists
      title: event.title,
      allDay: event.allDay,
      start: event.start || new Date(),
      end: event.end || event.start || new Date(),
      extendedProps: {
        category: event.extendedProps.category,
        ...(event.extendedProps.description && {
          description: event.extendedProps.description,
        }), // Include description if it exists in the extended properties
      },
    };
  };

  // Handler for date click events to switch the view to the day view for the clicked date
  const handleDateClick = (date: DateInput) => {
    if (calendarApi) {
      calendarApi.changeView("timeGridDay", date);
    }
  };

  // Handler for event drop (drag-and-drop) to update the event's position
  const handleEventDrop = ({ event }: { event: EventImpl }) => {
    return handleUpdateEvent(parseEvent(event));
  };

  // Handler for event resize to update the event's timing
  const handleEventResize = ({ event }: { event: EventImpl }) => {
    return handleUpdateEvent(parseEvent(event));
  };

  // Handler for event click to open the event sidebar and display event details
  const handleEventClick = ({
    event,
    jsEvent,
  }: {
    event: EventImpl;
    jsEvent: MouseEvent;
  }) => {
    jsEvent.preventDefault(); // Prevent default behavior like following a link

    // Call the event selection handler and open the event sidebar
    handleSelectEvent(parseEvent(event));
    setEventSidebarIsOpen(true);
  };

  // Map events from the state and assign a color based on their category
  const events = calendarState.events.map(
    (event: EventType): EventSourceInput[] => ({
      ...event,
      // @ts-ignore: Ignoring TypeScript error for color property type
      color: eventColors[event.extendedProps.category], // Set color based on event category
    })
  );

  // Custom class names for event styling
  const eventClassNames = () => [
    "h-[1.62rem] pt-px px-1 rounded-md",
    "[&_td]:hover:!bg-accent/60", // Styling for hover state on table cells
  ];

  return (
    <FullCalendar
      ref={calendarRef} // Reference for accessing the FullCalendar instance
      direction={direction}
      initialView={INITIAL_VIEW} // Initial calendar view on load
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]} // List of FullCalendar plugins for functionality
      eventDisplay="block" // Display events as block elements
      events={events} // Events data for the calendar
      eventClassNames={eventClassNames} // Custom class names for styling events
      headerToolbar={false} // Hide the default header toolbar
      editable // Allow events to be edited through drag-and-drop
      eventResizableFromStart // Allow resizing events from the start
      dragScroll // Enable scrolling while dragging events
      dayMaxEvents={2} // Limit the number of events displayed per day
      height={isMobile ? "calc(100svh - 20rem)" : "calc(100vh - 17rem)"}
      navLinks // Allow navigation links for days and weeks
      navLinkDayClick={handleDateClick} // Callback for day navigation link click
      eventDrop={handleEventDrop} // Event handler for drag-and-drop
      eventResize={handleEventResize} // Event handler for resizing events
      eventClick={handleEventClick} // Event handler for clicking events
    />
  );
}
