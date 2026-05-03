import { NextResponse } from "next/server"

import { requireApiUser } from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Read-only fetch of a single Communication row including its body.
 *
 * Used by drilldown drawers (Todos, Pending Replies, AI Suggestions) to
 * surface the source email body inline without forcing the user to
 * navigate to a separate page. Matt's "click and read" requirement.
 *
 * Security: just authentication. No body redaction beyond what was already
 * applied at storage time by `email-filter-redaction.ts`.
 */
export async function GET(_request: Request, ctx: RouteContext): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const { id } = await ctx.params
  const comm = await db.communication.findUnique({
    where: { id },
    select: {
      id: true,
      channel: true,
      subject: true,
      body: true,
      date: true,
      direction: true,
      externalMessageId: true,
      contactId: true,
      dealId: true,
      contact: { select: { id: true, name: true, email: true, company: true } },
      deal: {
        select: {
          id: true,
          propertyAddress: true,
          stage: true,
        },
      },
      metadata: true,
    },
  })
  if (!comm) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  // The metadata is a JSON blob; pluck the from/to details for display only.
  let fromName: string | null = null
  let fromAddress: string | null = null
  if (comm.metadata && typeof comm.metadata === "object" && !Array.isArray(comm.metadata)) {
    const meta = comm.metadata as Record<string, unknown>
    const from = meta.from as Record<string, unknown> | undefined
    if (from && typeof from === "object") {
      const name = from.name ?? from.displayName
      if (typeof name === "string") fromName = name
      const addr = from.address ?? (from.emailAddress as Record<string, unknown> | undefined)?.address
      if (typeof addr === "string") fromAddress = addr
    }
  }

  return NextResponse.json({
    communication: {
      id: comm.id,
      channel: comm.channel,
      subject: comm.subject,
      body: comm.body,
      date: comm.date.toISOString(),
      direction: comm.direction,
      externalMessageId: comm.externalMessageId,
      from: fromName || fromAddress ? { name: fromName, address: fromAddress } : null,
      contact: comm.contact,
      deal: comm.deal,
    },
  })
}
