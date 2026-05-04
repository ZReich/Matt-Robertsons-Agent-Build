import { format } from "date-fns"

import { db } from "@/lib/prisma"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  contactId: string
}

export function ContactUpcomingMeetingsCardFallback() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}

export async function ContactUpcomingMeetingsCard({ contactId }: Props) {
  const now = new Date()
  const attendees = await db.meetingAttendee.findMany({
    where: {
      contactId,
      meeting: { archivedAt: null, date: { gte: now } },
    },
    orderBy: { meeting: { date: "asc" } },
    take: 3,
    select: {
      meeting: {
        select: { id: true, title: true, date: true, location: true },
      },
    },
  })

  const meetings = attendees
    .map((row) => row.meeting)
    .filter((m): m is NonNullable<typeof m> => m !== null)

  if (meetings.length === 0) {
    // Empty state instead of returning null — Suspense skeleton →
    // null caused a layout pop. Render the section header with a
    // placeholder so the page structure stays stable.
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No upcoming meetings scheduled.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Upcoming
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {meetings.map((m) => (
          <div key={m.id} className="flex justify-between text-sm">
            <span className="font-medium">{m.title}</span>
            <span className="text-muted-foreground">
              {format(m.date, "MMM d, h:mm a")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
