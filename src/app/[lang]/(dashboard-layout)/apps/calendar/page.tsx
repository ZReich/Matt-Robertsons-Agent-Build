import { getEventsData } from "./actions/get-calendar-events-data";

import { CalendarApp } from "./_components/calendar-app";

export default async function CalendarPage() {
  const eventsData = await getEventsData();

  return <CalendarApp events={eventsData} />;
}
