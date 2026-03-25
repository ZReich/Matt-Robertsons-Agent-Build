import type { Metadata } from "next"
import { Calendar } from "lucide-react"

import { listNotes } from "@/lib/vault"
import type { MeetingMeta } from "@/lib/vault"

import { CalendarView } from "./_components/calendar-view"

export const metadata: Metadata = {
  title: "Meetings",
}

export default async function CalendarPage() {
  const meetings = await listNotes<MeetingMeta>("meetings")

  const upcoming = meetings.filter(
    (m) => new Date(m.meta.date) >= new Date()
  ).length
  const total = meetings.length

  return (
    <section className="container max-w-3xl grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Calendar className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming} upcoming &middot; {total - upcoming} in the last 30 days
          </p>
        </div>
      </div>

      <CalendarView meetings={meetings} />
    </section>
  )
}
