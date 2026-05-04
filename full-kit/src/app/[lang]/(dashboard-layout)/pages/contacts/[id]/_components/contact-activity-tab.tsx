import { format } from "date-fns"
import { Calendar } from "lucide-react"

import type { ReactNode } from "react"
import type { CommRow } from "./contact-comm-row"

import { db } from "@/lib/prisma"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { renderCommRow } from "./contact-comm-row"

interface Props {
  contactId: string
  lang: string
}

export function ContactActivityTabFallback() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

type MeetingRow = {
  id: string
  title: string
  date: Date
  location: string | null
}

type ActivityEvent =
  | { kind: "comm"; date: Date; comm: CommRow }
  | { kind: "meeting"; date: Date; meeting: MeetingRow }

function buildActivityFeed(
  comms: CommRow[],
  meetings: MeetingRow[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...comms.map((comm) => ({ kind: "comm" as const, date: comm.date, comm })),
    ...meetings.map((meeting) => ({
      kind: "meeting" as const,
      date: meeting.date,
      meeting,
    })),
  ]
  // Sort by date desc with id tiebreaker so render order is stable across
  // re-renders when two events share a millisecond.
  events.sort((a, b) => {
    const dt = b.date.getTime() - a.date.getTime()
    if (dt !== 0) return dt
    const idA = a.kind === "comm" ? a.comm.id : a.meeting.id
    const idB = b.kind === "comm" ? b.comm.id : b.meeting.id
    return idA.localeCompare(idB)
  })
  return events
}

function renderActivityEvent(event: ActivityEvent, lang: string): ReactNode {
  if (event.kind === "comm") {
    return (
      <div
        key={`comm:${event.comm.id}`}
        className="border-b py-2 last:border-b-0"
      >
        {renderCommRow(event.comm, lang)}
      </div>
    )
  }
  return (
    <div
      key={`meeting:${event.meeting.id}`}
      className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0"
    >
      <Calendar className="size-4 shrink-0 text-amber-500" />
      <span className="flex-1 truncate font-medium">{event.meeting.title}</span>
      {event.meeting.location ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {event.meeting.location}
        </span>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground">
        {format(event.meeting.date, "MMM d, yyyy h:mm a")}
      </span>
    </div>
  )
}

export async function ContactActivityTab({ contactId, lang }: Props) {
  const COMM_LIMIT = 200
  const [contactComms, totalCommCount, attendees] = await Promise.all([
    db.communication.findMany({
      where: { contactId, archivedAt: null },
      orderBy: { date: "desc" },
      take: COMM_LIMIT,
      select: {
        id: true,
        channel: true,
        subject: true,
        date: true,
        direction: true,
        createdBy: true,
        externalMessageId: true,
        deal: { select: { id: true, propertyAddress: true } },
      },
    }),
    db.communication.count({
      where: { contactId, archivedAt: null },
    }),
    db.meetingAttendee.findMany({
      where: { contactId, meeting: { archivedAt: null } },
      orderBy: { meeting: { date: "desc" } },
      select: {
        meeting: {
          select: {
            id: true,
            title: true,
            date: true,
            location: true,
          },
        },
      },
    }),
  ])

  const meetings = attendees
    .map((row) => row.meeting)
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const totalActivity = totalCommCount + meetings.length
  const commsTruncated = totalCommCount > contactComms.length

  if (totalActivity === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No activity recorded for this contact yet.
      </p>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        {commsTruncated ? (
          <p className="mb-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Showing latest {contactComms.length} communications of{" "}
            {totalCommCount} total. Older communications are not rendered.
          </p>
        ) : null}
        {buildActivityFeed(contactComms, meetings).map((event) =>
          renderActivityEvent(event, lang)
        )}
      </CardContent>
    </Card>
  )
}
