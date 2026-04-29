import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  parsePipelineFilters,
  serializeLeadBoard,
} from "@/lib/pipeline/server/board"
import { patchLeadRecord } from "@/lib/pipeline/server/lead-actions"
import { getLeadContactsForPipeline } from "@/lib/pipeline/server/leads-query"

export async function GET(request: NextRequest): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const filters = parsePipelineFilters(request.nextUrl.searchParams)
  const leads = await getLeadContactsForPipeline(filters)

  return NextResponse.json(serializeLeadBoard(leads, filters))
}

export async function PATCH(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id : null
  if (!id)
    return NextResponse.json({ error: "id is required" }, { status: 400 })

  return patchLeadRecord(id, body)
}
