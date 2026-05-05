import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/communications/[id]/archive
 *
 * Sets `archivedAt = now()`. Idempotent — calling on an already-archived
 * row is a no-op. Operator-only (reviewer auth).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    await requireAgentReviewer()
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
  const existing = await db.communication.findUnique({
    where: { id },
    select: { id: true, channel: true, archivedAt: true, metadata: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  // Scope this endpoint to Plaud-source call communications only — it's
  // the archive button on the Transcripts triage page. Callers shouldn't
  // be able to archive emails or non-Plaud calls through this path.
  const meta = (existing.metadata ?? {}) as Record<string, unknown>
  if (existing.channel !== "call" || meta.source !== "plaud") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (existing.archivedAt) {
    return NextResponse.json({ ok: true, alreadyArchived: true })
  }
  await db.communication.update({
    where: { id },
    data: { archivedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
