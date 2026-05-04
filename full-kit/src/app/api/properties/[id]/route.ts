import { NextResponse } from "next/server"

import type { Prisma, PropertyStatus, PropertyType } from "@prisma/client"

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

interface RouteContext {
  params: Promise<{ id: string }>
}

function decimalInput(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const cleaned =
    typeof value === "string" ? value.replace(/[$,%\s]/g, "") : value
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return undefined
  if (n < 0) return undefined
  if (n > 1e12) return undefined
  return n
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const t = value.trim()
  return t.length > 0 ? t : undefined
}

export async function GET(
  _request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const property = await db.property.findUnique({
    where: { id },
    include: {
      deals: {
        where: { archivedAt: null },
        select: {
          id: true,
          stage: true,
          value: true,
          contact: { select: { id: true, name: true, company: true } },
        },
      },
      pendingReplies: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!property)
    return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ property })
}

export async function PATCH(
  request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  const { id } = await ctx.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const existing = await db.property.findUnique({ where: { id } })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })

  const update: Prisma.PropertyUpdateInput = {}

  // Track whether any address-component changed; if so, recompute propertyKey.
  let recomputeKey = false

  for (const field of [
    "name",
    "unit",
    "city",
    "state",
    "zip",
    "description",
    "listingUrl",
    "flyerUrl",
    "notes",
    "externalId",
    "source",
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const v = trimmedString(body[field])
      ;(update as Record<string, unknown>)[field] = v ?? null
      if (
        field === "unit" ||
        field === "city" ||
        field === "state" ||
        field === "zip"
      ) {
        recomputeKey = true
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "address")) {
    const v = trimmedString(body.address)
    if (!v) {
      return NextResponse.json(
        { error: "address cannot be empty" },
        { status: 400 }
      )
    }
    update.address = v
    recomputeKey = true
  }

  if (Object.prototype.hasOwnProperty.call(body, "propertyType")) {
    const v = trimmedString(body.propertyType)
    if (v && !isPropertyType(v)) {
      return NextResponse.json(
        { error: "invalid propertyType" },
        { status: 400 }
      )
    }
    update.propertyType = (v as PropertyType | undefined) ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const v = trimmedString(body.status)
    if (!v || !PROPERTY_STATUS_SET.has(v)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 })
    }
    update.status = v as PropertyStatus
    if (v === "under_contract" && !existing.underContractAt) {
      update.underContractAt = new Date()
    }
    if (v === "closed" && !existing.closedAt) {
      update.closedAt = new Date()
    }
    if (v === "archived" && !existing.archivedAt) {
      update.archivedAt = new Date()
    }
  }

  for (const field of ["squareFeet", "occupiedSquareFeet"] as const) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const v = decimalInput(body[field])
      ;(update as Record<string, unknown>)[field] =
        v === undefined ? null : Math.round(v)
    }
  }
  for (const field of ["listPrice", "capRate"] as const) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const v = decimalInput(body[field])
      ;(update as Record<string, unknown>)[field] = v === undefined ? null : v
    }
  }

  if (recomputeKey) {
    const merged = {
      address: (update.address as string | undefined) ?? existing.address,
      unit:
        ("unit" in update
          ? (update.unit as string | null | undefined)
          : existing.unit) ?? null,
      city:
        ("city" in update
          ? (update.city as string | null | undefined)
          : existing.city) ?? null,
      state:
        ("state" in update
          ? (update.state as string | null | undefined)
          : existing.state) ?? null,
      zip:
        ("zip" in update
          ? (update.zip as string | null | undefined)
          : existing.zip) ?? null,
    }
    update.propertyKey = computePropertyKey(merged)
  }

  try {
    const property = await db.property.update({ where: { id }, data: update })
    return NextResponse.json({ ok: true, property })
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
            "Another property already has this address+unit. Pick a different unit or merge the records.",
        },
        { status: 409 }
      )
    }
    console.error("[api/properties/:id] update failed", error)
    return NextResponse.json(
      { error: "Failed to update property" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  const { id } = await ctx.params
  const existing = await db.property.findUnique({
    where: { id },
    include: { _count: { select: { deals: true } } },
  })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })

  if (existing._count.deals > 0) {
    // Soft delete via archive when deals reference this property — keeps the
    // foreign key intact for historical reporting.
    const property = await db.property.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date() },
    })
    return NextResponse.json({ ok: true, archived: true, property })
  }

  await db.property.delete({ where: { id } })
  return NextResponse.json({ ok: true, deleted: true })
}
