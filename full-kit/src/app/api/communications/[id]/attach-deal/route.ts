import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/communications/[id]/attach-deal
 *
 * Body: { dealId: string | null }
 *
 * Sets `Communication.dealId` so the transcript shows on the deal's
 * timeline. Independent of `attach-contact` — a transcript can be
 * attached to a contact AND a deal at the same time. Pass
 * `dealId: null` to detach.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  let reviewer
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    reviewer = await requireAgentReviewer()
  } catch (err) {
    if (err instanceof ReviewerAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const dealId = (body as { dealId?: unknown })?.dealId
  if (
    dealId !== null &&
    (typeof dealId !== "string" || dealId.length === 0)
  ) {
    return NextResponse.json({ error: "invalid_dealId" }, { status: 400 })
  }

  if (typeof dealId === "string") {
    const deal = await db.deal.findUnique({
      where: { id: dealId },
      select: { id: true, archivedAt: true },
    })
    if (!deal || deal.archivedAt) {
      return NextResponse.json({ error: "deal_not_found" }, { status: 422 })
    }
  }

  const existing = await db.communication.findUnique({
    where: { id },
    select: { id: true, channel: true, dealId: true, metadata: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  const meta = (existing.metadata ?? {}) as Record<string, unknown>
  if (existing.channel !== "call" || meta.source !== "plaud") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (existing.dealId === dealId) {
    return NextResponse.json({ ok: true, alreadyAttached: true })
  }

  const dealSuggestions = Array.isArray(meta.dealSuggestions)
    ? (meta.dealSuggestions as Array<{
        dealId: string
        score: number
        source: string
      }>)
    : []
  const matchedSuggestion =
    dealId === null
      ? null
      : dealSuggestions.find((s) => s.dealId === dealId)
  const newMeta: Record<string, unknown> = {
    ...meta,
    dealAttachedAt: new Date().toISOString(),
    dealAttachedBy: reviewer.label,
    dealReviewStatus: dealId === null ? "skipped" : "linked",
  }
  if (matchedSuggestion) {
    newMeta.dealAttachedFromSuggestion = {
      dealId: matchedSuggestion.dealId,
      score: matchedSuggestion.score,
      source: matchedSuggestion.source,
    }
  } else {
    delete newMeta.dealAttachedFromSuggestion
  }

  await db.communication.update({
    where: { id },
    data: {
      dealId: dealId,
      metadata: newMeta as object,
    },
  })

  return NextResponse.json({ ok: true })
}
