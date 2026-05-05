import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

const MAX_LIMIT = 25
const DEFAULT_LIMIT = 10

/**
 * GET /api/contacts
 *
 * Lightweight contact search for picker components. Filters by `q`
 * across name / company / email (ILIKE). Returns up to 25 active
 * (non-archived) contacts ordered by name.
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
  const q = url.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )

  const where = {
    archivedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { company: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const items = await db.contact.findMany({
    where,
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
    },
  })
  return NextResponse.json({ items })
}
