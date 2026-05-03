import { NextResponse } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_STATUS = new Set(["upcoming", "completed", "dismissed"])

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const event = await db.calendarEvent.findUnique({
    where: { id },
    include: {
      contact: { select: { id: true, name: true, email: true } },
      property: { select: { id: true, name: true, address: true } },
      deal: { select: { id: true, propertyAddress: true } },
      leaseRecord: true,
    },
  })
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ event })
}

/**
 * PATCH /api/calendar/events/{id}
 *
 * Updates the status of a CalendarEvent. The drawer's "Mark complete" and
 * "Dismiss" buttons hit this route. We deliberately do NOT support editing
 * other fields here — system-generated rows should be regenerated via the
 * renewal-sweep / extractor pipelines, not patched ad-hoc.
 *
 * Request body: { status: "upcoming" | "completed" | "dismissed" }
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  const { id } = await ctx.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const status = typeof body.status === "string" ? body.status : null
  if (!status || !VALID_STATUS.has(status)) {
    return NextResponse.json(
      {
        error: `status must be one of: ${[...VALID_STATUS].join(", ")}`,
      },
      { status: 400 }
    )
  }

  const existing = await db.calendarEvent.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const updated = await db.calendarEvent.update({
    where: { id },
    data: { status },
  })

  return NextResponse.json({ ok: true, event: updated })
}
