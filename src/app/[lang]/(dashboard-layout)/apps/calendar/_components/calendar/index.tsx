"use client";

import { Card } from "@/components/ui/card";
import { CalendarHeader } from "./calendar-header";
import { CalendarContent } from "./calendar-content";

export function Calendar() {
  return (
    <Card>
      <CalendarHeader />
      <CalendarContent />
    </Card>
  );
}
