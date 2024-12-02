"use client";

import * as React from "react";

import { categoriesData } from "../_data/categories";

import { CalendarReducer } from "../reducers/calendar-reducer";

import type {
  CalendarContextType,
  CategoryType,
  EventType,
  EventWithoutIdType,
} from "../types";
import type { CalendarApi } from "@fullcalendar/core/index.js";

export const CalendarContext = React.createContext<
  CalendarContextType | undefined
>(undefined);

export function CalendarProvider({
  events,
  children,
}: {
  events: EventType[];
  children: React.ReactNode;
}) {
  const [calendarState, dispatch] = React.useReducer(CalendarReducer, {
    events,
    selectedCategories: [...categoriesData],
  });
  const [calendarApi, setCalendarApi] = React.useState<null | CalendarApi>(
    null
  );
  const [eventSidebarIsOpen, setEventSidebarIsOpen] = React.useState(false);

  const handleAddEvent = (event: EventWithoutIdType) => {
    dispatch({
      type: "addEvent",
      event: { ...event, id: calendarState.events.length.toString() },
    });
  };

  const handleUpdateEvent = (event: EventType) => {
    dispatch({ type: "updateEvent", event });
  };

  const handleDeleteEvent = (eventId: EventType["id"]) => {
    dispatch({ type: "deleteEvent", eventId });
  };

  const handleSelectEvent = (event?: EventType) => {
    dispatch({ type: "selectEvent", event: event });
  };

  const handleSelectCategory = (category: CategoryType) => {
    dispatch({ type: "selectCategory", category });
  };

  const handleSelectAllCategories = (isSelectAllCategories: boolean) => {
    dispatch({ type: "selectAllCategories", isSelectAllCategories });
  };

  return (
    <CalendarContext.Provider
      value={{
        calendarState,
        calendarApi,
        setCalendarApi,
        eventSidebarIsOpen,
        setEventSidebarIsOpen,
        handleUpdateEvent,
        handleAddEvent,
        handleDeleteEvent,
        handleSelectEvent,
        handleSelectCategory,
        handleSelectAllCategories,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}
