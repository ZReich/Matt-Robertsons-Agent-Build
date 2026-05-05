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
            { propertyAddress: { contains: q, mode: "insensitive" as const } },
            { notes: { contains: q, mode: "insensitive" as const } },
            {
              contact: {
                name: { contains: q, mode: "insensitive" as const },
              },
            },
            {
              contact: {
                company: { contains: q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  }

  const items = await db.deal.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      propertyAddress: true,
      stage: true,
      contact: { select: { id: true, name: true, company: true } },
    },
  })

  return NextResponse.json({
    items: items.map((deal) => ({
      id: deal.id,
      propertyAddress: deal.propertyAddress,
      stage: deal.stage,
      contactId: deal.contact.id,
      contactName: deal.contact.name,
      contactCompany: deal.contact.company,
    })),
  })
}
