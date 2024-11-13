"use client";

import * as React from "react";

import { CalendarContext } from "../contexts/calendar-context";

export function useCalendarContext() {
  const context = React.useContext(CalendarContext);
  if (context === undefined) {
    throw new Error(
      "useCalendarContext must be used within a CalendarProvider"
    );
  }
  return context;
}
