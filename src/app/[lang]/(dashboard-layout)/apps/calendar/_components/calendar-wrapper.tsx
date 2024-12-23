import type { EventType } from "../types";

import { CalendarProvider } from "../contexts/calendar-context";
import { EventSidebar } from "./event-sidebar";

export function CalendarWrapper({
  events,
  children,
}: {
  events: EventType[];
  children: React.ReactNode;
}) {
  return (
    <CalendarProvider events={events}>
      <div className="container p-4">
        {children}
        <EventSidebar />
      </div>
    </CalendarProvider>
  );
}
