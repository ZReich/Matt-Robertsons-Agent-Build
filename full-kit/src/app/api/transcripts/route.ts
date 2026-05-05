import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

type StatusFilter = "needs_review" | "matched" | "archived"

/**
 * GET /api/transcripts
 *
 * Query params:
 *   status: needs_review (default) | matched | archived
 *   q: optional free-text filter against subject + body (ILIKE)
 *   cursor: id of the last row from the previous page
 *   limit: 1..100 (default 50)
 *
 * Returns Plaud-sourced Communication rows (channel="call",
 * metadata.source="plaud") + a flattened topSuggestion convenience.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    await requireAgentReviewer()
  } catch (err) {
    if (err instanceof ReviewerAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status") ?? "needs_review"
  if (
    statusParam !== "needs_review" &&
    statusParam !== "matched" &&
    statusParam !== "archived"
  ) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 })
  }
  const status = statusParam as StatusFilter
  const q = url.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  const cursor = url.searchParams.get("cursor") ?? undefined

  // Filter on metadata->>'source' = 'plaud' via Prisma JSON path filter.
  const where = {
    channel: "call" as const,
    metadata: { path: ["source"], equals: "plaud" },
    ...(status === "needs_review"
      ? { contactId: null, archivedAt: null }
      : status === "matched"
        ? { contactId: { not: null }, archivedAt: null }
        : { archivedAt: { not: null } }),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const rows = await db.communication.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit + 1, // +1 to compute hasNext
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      subject: true,
      date: true,
      durationSeconds: true,
      contactId: true,
      archivedAt: true,
      metadata: true,
    },
  })
  const hasNext = rows.length > limit
  const items = (hasNext ? rows.slice(0, limit) : rows).map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    const suggestions = Array.isArray(meta.suggestions)
      ? (meta.suggestions as Array<{
          contactId: string
          score: number
          source: string
          reason: string
        }>)
      : []
    return {
      id: r.id,
      filename: r.subject ?? "",
      date: r.date,
      durationSeconds: r.durationSeconds,
      contactId: r.contactId,
      archivedAt: r.archivedAt,
      topSuggestion: suggestions[0] ?? null,
      hasAiSkip: meta.aiSkipReason === "sensitive_keywords",
    }
  })
  return NextResponse.json({
    items,
    nextCursor: hasNext ? items[items.length - 1]?.id : null,
  })
}
