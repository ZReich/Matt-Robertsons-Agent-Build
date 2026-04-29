import { NextResponse } from "next/server"

import type { DealStage, PropertyType } from "@prisma/client"
import type { NextRequest } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  narrowToBoardDeals,
  parsePipelineFilters,
  serializeDealBoard,
} from "@/lib/pipeline/server/board"
import { DEAL_STAGES } from "@/lib/pipeline/stage-probability"
import { db } from "@/lib/prisma"

const PROPERTY_TYPES = new Set<PropertyType>([
  "office",
  "retail",
  "industrial",
  "multifamily",
  "land",
  "mixed_use",
  "hospitality",
  "medical",
  "other",
])

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function decimalInput(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export async function GET(request: NextRequest): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const filters = parsePipelineFilters(request.nextUrl.searchParams)
  const closedCutoff = daysAgo(90)

  const dealsRaw = await db.deal.findMany({
    where: {
      archivedAt: null,
      // Board surfaces only seller-rep deals with a parsed property; buyer-rep
      // and unparsed-property deals get their own surfaces later.
      dealType: "seller_rep",
      propertyAddress: { not: null },
      propertyType: { not: null },
      ...(filters.propertyType ? { propertyType: filters.propertyType } : {}),
      ...(filters.source ? { contact: { leadSource: filters.source } } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                propertyAddress: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                contact: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
              {
                contact: {
                  company: { contains: filters.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      ...(filters.showAll
        ? {}
        : {
            OR: [
              { stage: { not: "closed" } },
              { stageChangedAt: { gte: closedCutoff } },
              { stageChangedAt: null, updatedAt: { gte: closedCutoff } },
            ],
          }),
    },
    include: {
      contact: {
        select: { id: true, name: true, company: true, leadSource: true },
      },
    },
    orderBy: [{ stageChangedAt: "desc" }, { updatedAt: "desc" }],
  })

  const deals = narrowToBoardDeals(dealsRaw)
  return NextResponse.json(serializeDealBoard(deals, filters))
}

export async function POST(request: Request): Promise<Response> {
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

  const contactId = typeof body.contactId === "string" ? body.contactId : null
  const propertyAddress =
    typeof body.propertyAddress === "string" && body.propertyAddress.trim()
      ? body.propertyAddress.trim()
      : null
  const propertyType =
    typeof body.propertyType === "string" &&
    PROPERTY_TYPES.has(body.propertyType as PropertyType)
      ? (body.propertyType as PropertyType)
      : null
  const stage =
    typeof body.stage === "string" &&
    DEAL_STAGES.includes(body.stage as DealStage)
      ? (body.stage as DealStage)
      : "prospecting"

  if (!contactId || !propertyAddress || !propertyType) {
    return NextResponse.json(
      { error: "contactId, propertyAddress, and propertyType are required" },
      { status: 400 }
    )
  }

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { id: true },
  })
  if (!contact)
    return NextResponse.json({ error: "contact not found" }, { status: 404 })

  const value = decimalInput(body.value)
  const commissionRate = decimalInput(body.commissionRate)
  const probability =
    body.probability === undefined ? undefined : Number(body.probability)
  if (
    probability !== undefined &&
    (!Number.isInteger(probability) || probability < 0 || probability > 100)
  ) {
    return NextResponse.json(
      { error: "probability must be 0-100" },
      { status: 400 }
    )
  }

  const deal = await db.deal.create({
    data: {
      contactId,
      propertyAddress,
      propertyType,
      stage,
      stageChangedAt: new Date(),
      ...(value !== undefined ? { value } : {}),
      ...(probability !== undefined ? { probability } : {}),
      ...(commissionRate !== undefined ? { commissionRate } : {}),
    },
  })

  return NextResponse.json({ ok: true, deal }, { status: 201 })
}
