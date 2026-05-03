import { NextResponse } from "next/server"

import type { Prisma, PropertyStatus, PropertyType } from "@prisma/client"
import type { NextRequest } from "next/server"

import { authenticateUser } from "@/lib/auth"
import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"
import {
  PROPERTY_STATUS_VALUES,
  computePropertyKey,
  isPropertyType,
} from "@/lib/properties/property-utils"

const PROPERTY_STATUS_SET = new Set<string>(PROPERTY_STATUS_VALUES)

function decimalInput(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const cleaned =
    typeof value === "string" ? value.replace(/[$,%\s]/g, "") : value
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return undefined
  if (n < 0) return undefined
  // Cap at 1e12 so a fat-fingered list price doesn't trip Decimal(14,2)
  // overflow at write time with an opaque Prisma error.
  if (n > 1e12) return undefined
  return n
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export async function GET(request: NextRequest): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const sp = request.nextUrl.searchParams
  const search = sp.get("search")?.trim() ?? ""
  const status = sp.get("status")
  const propertyType = sp.get("type")
  const includeArchived = sp.get("includeArchived") === "1"

  const where: Prisma.PropertyWhereInput = {
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(status && PROPERTY_STATUS_SET.has(status)
      ? { status: status as PropertyStatus }
      : {}),
    ...(isPropertyType(propertyType)
      ? { propertyType: propertyType as PropertyType }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const properties = await db.property.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: { deals: true, pendingReplies: true },
      },
    },
  })
  return NextResponse.json({ properties })
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

  const address = trimmedString(body.address)
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 })
  }

  const sessionUser = await authenticateUser()

  const name = trimmedString(body.name)
  const unit = trimmedString(body.unit)
  const city = trimmedString(body.city)
  const state = trimmedString(body.state)
  const zip = trimmedString(body.zip)
  const description = trimmedString(body.description)
  const listingUrl = trimmedString(body.listingUrl)
  const flyerUrl = trimmedString(body.flyerUrl)
  const externalId = trimmedString(body.externalId)
  const source = trimmedString(body.source) ?? "manual"

  const propertyTypeRaw = trimmedString(body.propertyType)
  const propertyType = isPropertyType(propertyTypeRaw)
    ? (propertyTypeRaw as PropertyType)
    : undefined

  const statusRaw = trimmedString(body.status)
  const status =
    statusRaw && PROPERTY_STATUS_SET.has(statusRaw)
      ? (statusRaw as PropertyStatus)
      : "active"

  const squareFeet = decimalInput(body.squareFeet)
  const occupiedSquareFeet = decimalInput(body.occupiedSquareFeet)
  const listPrice = decimalInput(body.listPrice)
  const capRate = decimalInput(body.capRate)

  const propertyKey = computePropertyKey({
    address,
    unit,
    city,
    state,
    zip,
  })

  try {
    const property = await db.property.create({
      data: {
        address,
        ...(name ? { name } : {}),
        ...(unit ? { unit } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
        ...(zip ? { zip } : {}),
        propertyKey,
        ...(propertyType ? { propertyType } : {}),
        status,
        ...(squareFeet !== undefined ? { squareFeet: Math.round(squareFeet) } : {}),
        ...(occupiedSquareFeet !== undefined
          ? { occupiedSquareFeet: Math.round(occupiedSquareFeet) }
          : {}),
        ...(listPrice !== undefined ? { listPrice } : {}),
        ...(capRate !== undefined ? { capRate } : {}),
        ...(listingUrl ? { listingUrl } : {}),
        ...(flyerUrl ? { flyerUrl } : {}),
        ...(description ? { description } : {}),
        ...(externalId ? { externalId } : {}),
        source,
        createdBy: sessionUser.email ?? sessionUser.id,
        listedAt: status === "active" ? new Date() : undefined,
        underContractAt: status === "under_contract" ? new Date() : undefined,
        closedAt: status === "closed" ? new Date() : undefined,
      },
    })
    return NextResponse.json({ ok: true, property }, { status: 201 })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "A property with this address+unit already exists. Edit the existing record instead.",
        },
        { status: 409 }
      )
    }
    console.error("[api/properties] create failed", error)
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    )
  }
}
