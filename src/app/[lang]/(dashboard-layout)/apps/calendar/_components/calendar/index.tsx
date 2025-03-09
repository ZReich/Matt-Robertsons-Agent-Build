"use client"

import { Card } from "@/components/ui/card"
import { CalendarContent } from "./calendar-content"
import { CalendarHeader } from "./calendar-header"

export function Calendar() {
  return (
    <Card>
      <CalendarHeader />
      <CalendarContent />
    </Card>
  )
}
