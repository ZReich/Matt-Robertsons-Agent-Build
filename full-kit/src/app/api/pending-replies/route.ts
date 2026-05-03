import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"
import type { PendingReplyStatus } from "@prisma/client"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { generatePendingReply } from "@/lib/ai/auto-reply"
import { db } from "@/lib/prisma"

const STATUS_VALUES = new Set<PendingReplyStatus>([
  "pending",
  "approved",
  "dismissed",
])

export async function GET(request: NextRequest): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const status = request.nextUrl.searchParams.get("status")
  const where =
    status && STATUS_VALUES.has(status as PendingReplyStatus)
      ? { status: status as PendingReplyStatus }
      : {}

  const replies = await db.pendingReply.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      property: {
        select: {
          id: true,
          name: true,
          address: true,
          listingUrl: true,
        },
      },
    },
  })
  return NextResponse.json({ replies })
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: { propertyId?: unknown; contactId?: unknown; triggerCommunicationId?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (typeof body.propertyId !== "string" || typeof body.contactId !== "string") {
    return NextResponse.json(
      { error: "propertyId and contactId are required strings" },
      { status: 400 }
    )
  }

  const result = await generatePendingReply({
    propertyId: body.propertyId,
    contactId: body.contactId,
    triggerCommunicationId:
      typeof body.triggerCommunicationId === "string"
        ? body.triggerCommunicationId
        : undefined,
    persist: true,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        details: result.details ?? null,
      },
      { status: result.reason === "missing_api_key" ? 503 : 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    pendingReplyId: result.pendingReplyId,
    draft: result.draft,
  })
}
