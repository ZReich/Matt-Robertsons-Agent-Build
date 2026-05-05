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
 * POST /api/communications/[id]/attach-contact
 *
 * Body: { contactId: string }
 *
 * Sets `Communication.contactId`. Preserves the full
 * `metadata.suggestions` blob for audit and additionally stamps
 * `metadata.attachedFromSuggestion` if the chosen contactId matches
 * one of the existing suggestions. Always stamps `attachedAt` and
 * `attachedBy`.
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
  const contactId = (body as { contactId?: unknown })?.contactId
  if (typeof contactId !== "string" || contactId.length === 0) {
    return NextResponse.json({ error: "invalid_contactId" }, { status: 400 })
  }

  const contact = await db.contact.findUnique({ where: { id: contactId } })
  if (!contact || contact.archivedAt) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 422 })
  }

  const existing = await db.communication.findUnique({
    where: { id },
    select: { id: true, channel: true, contactId: true, metadata: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  // Scope to Plaud-source call communications only — same reasoning as
  // the archive route.
  const meta = (existing.metadata ?? {}) as Record<string, unknown>
  if (existing.channel !== "call" || meta.source !== "plaud") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  // Idempotency: re-POSTing with the same contactId is a no-op so
  // attachedAt/attachedBy/attachedFromSuggestion don't get clobbered by
  // a double click.
  if (existing.contactId === contactId) {
    return NextResponse.json({ ok: true, alreadyAttached: true })
  }

  const suggestions = Array.isArray(meta.suggestions)
    ? (meta.suggestions as Array<{
        contactId: string
        score: number
        source: string
      }>)
    : []
  const matchedSuggestion = suggestions.find((s) => s.contactId === contactId)
  // Re-attach to a different contact: refresh attachedAt/attachedBy and
  // either overwrite attachedFromSuggestion (if Matt clicked a current
  // suggestion) or drop the stale one (so the audit trail isn't
  // ambiguous about which suggestion produced this attachment).
  const newMeta: Record<string, unknown> = {
    ...meta,
    attachedAt: new Date().toISOString(),
    attachedBy: reviewer.label,
  }
  if (matchedSuggestion) {
    newMeta.attachedFromSuggestion = {
      contactId: matchedSuggestion.contactId,
      score: matchedSuggestion.score,
      source: matchedSuggestion.source,
    }
  } else {
    delete newMeta.attachedFromSuggestion
  }

  await db.communication.update({
    where: { id },
    data: {
      contactId,
      metadata: newMeta as object,
    },
  })

  return NextResponse.json({ ok: true })
}
