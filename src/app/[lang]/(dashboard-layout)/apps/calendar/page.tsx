import { events } from "@/data/calendar-events";

import { CalendarApp } from "./_components/calendar-app";

export default function CalendarPage() {
  return <CalendarApp events={events} />;
}
