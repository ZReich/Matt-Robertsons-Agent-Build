import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"

import { requireApiUser } from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

/**
 * GET /api/calendar/events
 *
 * Returns the merged calendar feed: real `Meeting` rows (scheduled
 * interactions with attendees) plus system-generated `CalendarEvent` rows
 * (lease renewals, follow-ups, anniversaries). The calendar UI consumes
 * both arrays and renders them on a unified month grid.
 *
 * Query params (all optional):
 *   - from   ISO date (YYYY-MM-DD). Lower bound on event date.
 *   - to     ISO date (YYYY-MM-DD). Upper bound on event date.
 *   - kinds  Comma-separated list of CalendarEvent.eventKind values.
 *            When provided, filters the calendarEvents result; meetings
 *            are always included unless `kinds` explicitly omits "meeting".
 */
export async function GET(request: NextRequest): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const sp = request.nextUrl.searchParams
  const from = parseDate(sp.get("from"))
  const to = parseDate(sp.get("to"))
  const kindsRaw = sp.get("kinds")
  const kinds = kindsRaw
    ? kindsRaw
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : null

  const includeMeetings = !kinds || kinds.includes("meeting")
  // CalendarEvent kinds excluding the synthetic "meeting" tag (which only
  // matters for filtering Meeting rows on the client side).
  const eventKindFilter = kinds
    ? kinds.filter((k) => k !== "meeting")
    : null

  const meetingWhere: Prisma.MeetingWhereInput = { archivedAt: null }
  if (from || to) {
    meetingWhere.date = {}
    if (from) meetingWhere.date.gte = from
    if (to) meetingWhere.date.lte = to
  }

  const eventWhere: Prisma.CalendarEventWhereInput = {}
  if (from || to) {
    eventWhere.startDate = {}
    if (from) eventWhere.startDate.gte = from
    if (to) eventWhere.startDate.lte = to
  }
  if (eventKindFilter && eventKindFilter.length > 0) {
    eventWhere.eventKind = { in: eventKindFilter }
  }

  const [meetings, calendarEvents] = await Promise.all([
    includeMeetings
      ? db.meeting.findMany({
          where: meetingWhere,
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
        })
      : Promise.resolve([]),
    // Always run the calendarEvent query — even when the only requested
    // "kind" is "meeting", we want an empty array so the response shape is
    // stable.
    eventKindFilter && eventKindFilter.length === 0 && kinds !== null
      ? Promise.resolve([])
      : db.calendarEvent.findMany({
          where: eventWhere,
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

  return NextResponse.json({
    meetings: meetings.map((m) => ({
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
    })),
    calendarEvents: calendarEvents.map((e) => ({
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
            leaseStartDate:
              e.leaseRecord.leaseStartDate?.toISOString() ?? null,
            leaseTermMonths: e.leaseRecord.leaseTermMonths,
            rentAmount: e.leaseRecord.rentAmount?.toString() ?? null,
            rentPeriod: e.leaseRecord.rentPeriod,
            mattRepresented: e.leaseRecord.mattRepresented,
            status: e.leaseRecord.status,
            dealKind: e.leaseRecord.dealKind,
          }
        : null,
    })),
  })
}

function parseDate(input: string | null): Date | null {
  if (!input) return null
  // Accept YYYY-MM-DD as well as full ISO. Reject malformed input rather
  // than silently passing it to Prisma where it would throw.
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d
}
