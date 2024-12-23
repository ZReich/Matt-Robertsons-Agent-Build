import { eventsData } from "./_data/events";

import type { Metadata } from "next";

import { Calendar } from "./_components/calendar";
import { CalendarWrapper } from "./_components/calendar-wrapper";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
  return (
    <CalendarWrapper events={eventsData}>
      <Calendar />
    </CalendarWrapper>
  );
}
