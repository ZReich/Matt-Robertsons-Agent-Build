import { getEventsData } from "./actions/get-calendar-events-data";

import type { Metadata } from "next";

import { CalendarProvider } from "./contexts/calendar-context";
import { Calendar } from "./_components/calendar";
import { EventSidebar } from "./_components/event-sidebar";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  const eventsData = await getEventsData();

  return (
    <CalendarProvider events={eventsData}>
      <div className="container p-4">
        <Calendar />
        <EventSidebar />
      </div>
    </CalendarProvider>
  );
}
