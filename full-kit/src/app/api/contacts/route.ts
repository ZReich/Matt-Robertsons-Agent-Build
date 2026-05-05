import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import { ReviewerAuthError, requireAgentReviewer } from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

const MAX_LIMIT = 25
const DEFAULT_LIMIT = 10

type ContactSearchRow = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  role: string | null
}

/**
 * GET /api/contacts
 *
 * Lightweight contact search for picker components. Filters by `q`
 * across name / company / email / phone / tags (ILIKE). Returns up to 25 active
 * (non-archived) contacts ordered by name.
 */
export async function GET(request: Request): Promise<Response> {
  try {
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
    Math.max(
      Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  )

  if (q) {
    const like = `%${q.toLowerCase()}%`
    const rows = await db.$queryRaw<ContactSearchRow[]>(Prisma.sql`
      SELECT id, name, company, email, phone, role
      FROM contacts
      WHERE archived_at IS NULL
        AND (
          lower(coalesce(name, '')) LIKE ${like}
          OR lower(coalesce(company, '')) LIKE ${like}
          OR lower(coalesce(email, '')) LIKE ${like}
          OR lower(coalesce(phone, '')) LIKE ${like}
          OR lower(coalesce(role, '')) LIKE ${like}
          OR lower(coalesce(address, '')) LIKE ${like}
          OR lower(coalesce(notes, '')) LIKE ${like}
          OR lower(coalesce(tags::text, '')) LIKE ${like}
        )
      ORDER BY
        CASE WHEN lower(name) LIKE ${like} THEN 0 ELSE 1 END,
        name ASC,
        id ASC
      LIMIT ${limit}
    `)

    return NextResponse.json({
      items: rows.map((contact) => ({
        id: contact.id,
        name: contact.name,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
      })),
    })
  }

  const where = {
    archivedAt: null,
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
      phone: true,
      role: true,
    },
  })
  return NextResponse.json({ items })
}
