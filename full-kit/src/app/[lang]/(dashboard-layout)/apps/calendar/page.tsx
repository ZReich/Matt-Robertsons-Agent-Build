import { Calendar as CalendarIcon } from "lucide-react"

import type { Metadata } from "next"
import type {
  CalendarEventDTO,
  CalendarMeetingDTO,
} from "./_components/calendar-grid"

import { db } from "@/lib/prisma"

import { CalendarGrid } from "./_components/calendar-grid"

export const metadata: Metadata = {
  title: "Calendar",
}

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ lang: string }>
}

export default async function CalendarPage({ params }: Props) {
  const { lang } = await params

  // Default range: 2 years back through 10 years forward. Wide enough that
  // long-tail lease renewals (e.g. an Apr 2030 lease's outreach landing in
  // Oct 2029) are included in the initial seed and the client doesn't have
  // to refetch when the user navigates years. With take: 500 caps and ~350
  // events portfolio-wide, the payload stays small.
  const now = new Date()
  const from = new Date(now)
  from.setFullYear(from.getFullYear() - 2)
  const to = new Date(now)
  to.setFullYear(to.getFullYear() + 10)

  const [meetings, calendarEvents] = await Promise.all([
    db.meeting.findMany({
      where: { archivedAt: null, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      take: 500,
      include: {
        attendees: {
          include: {
            contact: { select: { id: true, name: true, email: true } },
          },
        },
        deal: { select: { id: true, propertyAddress: true } },
      },
    }),
    db.calendarEvent.findMany({
      where: { startDate: { gte: from, lte: to } },
      orderBy: { startDate: "asc" },
      take: 500,
      include: {
        contact: { select: { id: true, name: true, email: true } },
        property: { select: { id: true, name: true, address: true } },
        deal: { select: { id: true, propertyAddress: true } },
        leaseRecord: {
          select: {
            id: true,
            leaseEndDate: true,
            leaseStartDate: true,
            leaseTermMonths: true,
            rentAmount: true,
            rentPeriod: true,
            mattRepresented: true,
            status: true,
            dealKind: true,
          },
        },
      },
    }),
  ])

  const meetingDTOs: CalendarMeetingDTO[] = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    date: m.date.toISOString(),
    endDate: m.endDate?.toISOString() ?? null,
    durationMinutes: m.durationMinutes,
    location: m.location,
    notes: m.notes,
    category: m.category,
    dealId: m.dealId,
    deal: m.deal
      ? { id: m.deal.id, name: m.deal.propertyAddress ?? "(deal)" }
      : null,
    attendees: m.attendees.map((a) => ({
      id: a.id,
      role: a.role,
      contact: a.contact,
    })),
  }))

  const eventDTOs: CalendarEventDTO[] = calendarEvents.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate?.toISOString() ?? null,
    allDay: e.allDay,
    eventKind: e.eventKind,
    source: e.source,
    status: e.status,
    contactId: e.contactId,
    contact: e.contact,
    propertyId: e.propertyId,
    property: e.property,
    dealId: e.dealId,
    deal: e.deal
      ? { id: e.deal.id, name: e.deal.propertyAddress ?? "(deal)" }
      : null,
    leaseRecordId: e.leaseRecordId,
    leaseRecord: e.leaseRecord
      ? {
          id: e.leaseRecord.id,
          leaseEndDate: e.leaseRecord.leaseEndDate?.toISOString() ?? null,
          leaseStartDate: e.leaseRecord.leaseStartDate?.toISOString() ?? null,
          leaseTermMonths: e.leaseRecord.leaseTermMonths,
          rentAmount: e.leaseRecord.rentAmount?.toString() ?? null,
          rentPeriod: e.leaseRecord.rentPeriod,
          mattRepresented: e.leaseRecord.mattRepresented,
          status: e.leaseRecord.status,
          dealKind: e.leaseRecord.dealKind,
        }
      : null,
  }))

  const upcomingCount =
    meetingDTOs.filter((m) => new Date(m.date) >= now).length +
    eventDTOs.filter(
      (e) => new Date(e.startDate) >= now && e.status === "upcoming"
    ).length

  return (
    <section className="container max-w-7xl grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <CalendarIcon className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {upcomingCount} upcoming events &middot; meetings, lease renewals,
            and follow-ups in one view
          </p>
        </div>
      </div>

      <CalendarGrid
        lang={lang}
        meetings={meetingDTOs}
        calendarEvents={eventDTOs}
      />
    </section>
  )
}
