"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { CalendarApi } from "@fullcalendar/core/index.js";
import FullCalendar from "@fullcalendar/react";

import { categories } from "../constants";

import { calendarReducer } from "../reducers/calendar-reducer";

import type { Category, Event } from "../types";

import { Calendar } from "./calendar";
import { EventSidebar } from "./event-sidebar";

export function CalendarApp({ events }: { events: Event[] }) {
  const calendarRef = useRef<null | FullCalendar>(null);
  const [calendarApi, setCalendarApi] = useState<null | CalendarApi>(null);
  const [eventSidebarIsOpen, setEventSidebarIsOpen] = useState(false);
  const [calendarState, dispatch] = useReducer(calendarReducer, {
    events,
    selectedEvent: undefined,
    selectedCategories: [...categories],
  });

  useEffect(() => {
    if (!calendarApi && calendarRef.current) {
      setCalendarApi(calendarRef.current.getApi());
    }
  }, [calendarApi, setCalendarApi]);

  const handleAddEvent = async (event: Omit<Event, "id">) => {
    dispatch({
      type: "add",
      event: { ...event, id: calendarState.events.length.toString() },
    });
  };

  const handleUpdateEvent = async (event: Event) => {
    dispatch({ type: "update", event });
  };

  const handleDeleteEvent = async (eventId: Event["id"]) => {
    dispatch({ type: "delete", eventId });
  };

  const handleSelectEvent = (event: Event | undefined) => {
    dispatch({ type: "selectEvent", event: event });
  };

  const handleSelectCategory = (category: Category) => {
    dispatch({ type: "selectCategory", category });
  };

  const handleSelectAllCategories = (isSelectAllCategories: boolean) => {
    dispatch({ type: "selectAllCategories", isSelectAllCategories });
  };

  return (
    <div className="p-4">
      <Calendar
        ref={calendarRef}
        calendarState={calendarState}
        calendarApi={calendarApi}
        setCalendarApi={setCalendarApi}
        handleUpdateEvent={handleUpdateEvent}
        handleSelectEvent={handleSelectEvent}
        setEventSidebarIsOpen={setEventSidebarIsOpen}
        handleSelectCategory={handleSelectCategory}
        handleSelectAllCategories={handleSelectAllCategories}
      />
      <EventSidebar
        calendarState={calendarState}
        calendarApi={calendarApi}
        handleAddEvent={handleAddEvent}
        handleUpdateEvent={handleUpdateEvent}
        handleSelectEvent={handleSelectEvent}
        handleDeleteEvent={handleDeleteEvent}
        eventSidebarIsOpen={eventSidebarIsOpen}
        setEventSidebarIsOpen={setEventSidebarIsOpen}
      />
    </div>
  );
}
