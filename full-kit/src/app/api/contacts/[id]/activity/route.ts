import { NextResponse } from "next/server"

import { requireApiUser } from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const COMM_LIMIT = 200

// Activity feed for a contact: combined comms + meetings, returned as
// JSON for the client-side fetch on the contact detail page's Activity
// tab. Server-render of this used to happen unconditionally inside the
// Tabs subtree on /pages/contacts/[id]; pulling it to a client-side
// fetch means the Overview tab no longer pays for these queries.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const { id: contactId } = await ctx.params

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

  return NextResponse.json({
    comms: contactComms,
    totalCommCount,
    meetings,
  })
}
