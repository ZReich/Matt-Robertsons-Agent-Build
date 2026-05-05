import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/transcripts/[id]
 *
 * Returns the full Plaud Communication row including metadata. Also
 * joins the related ExternalSync to expose raw turns for diagnostics.
 * 404 if not a Plaud-sourced communication.
 */
export async function GET(
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
  if (typeof id !== "string" || id.length === 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }
  const row = await db.communication.findUnique({
    where: { id },
    include: {
      contact: { select: { id: true, name: true } },
    },
  })
  const meta = (row?.metadata ?? {}) as Record<string, unknown>
  if (!row || row.channel !== "call" || meta.source !== "plaud") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  // Allow-list metadata fields. Internal AI error blobs and the raw
  // ExternalSync.rawData (full upstream payload) are NOT exposed to the
  // browser. Operators can pull those server-side via Prisma if they
  // need to debug.
  const safeMeta = {
    source: meta.source,
    plaudId: meta.plaudId,
    plaudFilename: meta.plaudFilename,
    plaudTagIds: Array.isArray(meta.plaudTagIds) ? meta.plaudTagIds : [],
    cleanedTurns: Array.isArray(meta.cleanedTurns) ? meta.cleanedTurns : [],
    aiSummaryRaw:
      typeof meta.aiSummaryRaw === "string" ? meta.aiSummaryRaw : null,
    extractedSignals:
      meta.extractedSignals && typeof meta.extractedSignals === "object"
        ? meta.extractedSignals
        : null,
    aiSkipReason:
      meta.aiSkipReason === "sensitive_keywords"
        ? "sensitive_keywords"
        : undefined,
    suggestions: Array.isArray(meta.suggestions) ? meta.suggestions : [],
    attachedAt: typeof meta.attachedAt === "string" ? meta.attachedAt : undefined,
    attachedBy: typeof meta.attachedBy === "string" ? meta.attachedBy : undefined,
    attachedFromSuggestion:
      meta.attachedFromSuggestion &&
      typeof meta.attachedFromSuggestion === "object"
        ? meta.attachedFromSuggestion
        : undefined,
  }
  return NextResponse.json({
    id: row.id,
    filename: row.subject ?? "",
    date: row.date,
    durationSeconds: row.durationSeconds,
    body: row.body,
    contactId: row.contactId,
    archivedAt: row.archivedAt,
    metadata: safeMeta,
    contact: row.contact,
  })
}
