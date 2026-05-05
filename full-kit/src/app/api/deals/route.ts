import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import { ReviewerAuthError, requireAgentReviewer } from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

const MAX_LIMIT = 25
const DEFAULT_LIMIT = 10

type DealSearchRow = {
  id: string
  property_address: string | null
  stage: string
  deal_type: string
  contact_id: string
  contact_name: string
  contact_company: string | null
  contact_email: string | null
  contact_phone: string | null
}

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
    const rows = await db.$queryRaw<DealSearchRow[]>(Prisma.sql`
      SELECT
        d.id,
        d.property_address,
        d.stage::text AS stage,
        d.deal_type::text AS deal_type,
        c.id AS contact_id,
        c.name AS contact_name,
        c.company AS contact_company,
        c.email AS contact_email,
        c.phone AS contact_phone
      FROM deals d
      JOIN contacts c ON c.id = d.contact_id
      WHERE d.archived_at IS NULL
        AND (
          lower(coalesce(d.property_address, '')) LIKE ${like}
          OR lower(coalesce(d.property_key, '')) LIKE ${like}
          OR lower(coalesce(d.unit, '')) LIKE ${like}
          OR lower(coalesce(d.notes, '')) LIKE ${like}
          OR lower(coalesce(d.stage::text, '')) LIKE ${like}
          OR lower(coalesce(d.deal_type::text, '')) LIKE ${like}
          OR lower(coalesce(d.property_aliases::text, '')) LIKE ${like}
          OR lower(coalesce(d.key_contacts::text, '')) LIKE ${like}
          OR lower(coalesce(d.tags::text, '')) LIKE ${like}
          OR lower(coalesce(c.name, '')) LIKE ${like}
          OR lower(coalesce(c.company, '')) LIKE ${like}
          OR lower(coalesce(c.email, '')) LIKE ${like}
          OR lower(coalesce(c.phone, '')) LIKE ${like}
        )
      ORDER BY
        CASE WHEN d.closed_at IS NULL AND d.stage::text <> 'closed' THEN 0 ELSE 1 END,
        d."updatedAt" DESC,
        d.id DESC
      LIMIT ${limit}
    `)

    return NextResponse.json({
      items: rows.map((deal) => ({
        id: deal.id,
        propertyAddress: deal.property_address,
        stage: deal.stage,
        dealType: deal.deal_type,
        contactId: deal.contact_id,
        contactName: deal.contact_name,
        contactCompany: deal.contact_company,
        contactEmail: deal.contact_email,
        contactPhone: deal.contact_phone,
      })),
    })
  }

  const where = {
    archivedAt: null,
  }

  const items = await db.deal.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      propertyAddress: true,
      stage: true,
      dealType: true,
      contact: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  return NextResponse.json({
    items: items.map((deal) => ({
      id: deal.id,
      propertyAddress: deal.propertyAddress,
      stage: deal.stage,
      dealType: deal.dealType,
      contactId: deal.contact.id,
      contactName: deal.contact.name,
      contactCompany: deal.contact.company,
      contactEmail: deal.contact.email,
      contactPhone: deal.contact.phone,
    })),
  })
}
