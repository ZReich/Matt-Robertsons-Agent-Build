import { NextResponse } from "next/server"

import type { Prisma, PropertyStatus, PropertyType } from "@prisma/client"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { authenticateUser } from "@/lib/auth"
import { db } from "@/lib/prisma"
import {
  computePropertyKey,
  parsePropertyCsv,
} from "@/lib/properties/property-utils"

// Hard row cap. Above this, the route will time out and leave the catalog
// half-written. Splitting into smaller imports is the right answer for
// mass-loading historical data — we can revisit with batched createMany if
// Genevieve's actual sheets push past this.
const MAX_ROWS_PER_IMPORT = 2000

function normalizeUnitKey(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase()
}

function dedupeKeyFor(
  propertyKey: string,
  unit: string | null | undefined
): string {
  return propertyKey + " | " + normalizeUnitKey(unit)
}

export async function POST(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: { csv?: unknown; dryRun?: unknown }
  try {
    body = (await request.json()) as { csv?: unknown; dryRun?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (typeof body.csv !== "string" || body.csv.trim().length === 0) {
    return NextResponse.json(
      { error: "csv (string) is required" },
      { status: 400 }
    )
  }

  const dryRun = body.dryRun === true
  const sessionUser = await authenticateUser()
  const createdBy = sessionUser.email ?? sessionUser.id

  const parsed = parsePropertyCsv(body.csv)
  if (parsed.rows.length === 0 && parsed.errors.length === 0) {
    return NextResponse.json(
      { error: "csv contained no data rows" },
      { status: 400 }
    )
  }

  if (parsed.rows.length > MAX_ROWS_PER_IMPORT) {
    return NextResponse.json(
      {
        error:
          "CSV has " +
          parsed.rows.length +
          " rows; max per import is " +
          MAX_ROWS_PER_IMPORT +
          ". Split the file and import in chunks.",
      },
      { status: 413 }
    )
  }

  // Pre-compute property keys + collect collisions within the file itself.
  const enriched = parsed.rows.map((row, idx) => {
    const propertyKey = computePropertyKey({
      address: row.address,
      unit: row.unit,
      city: row.city,
      state: row.state,
      zip: row.zip,
    })
    return { row, idx, propertyKey }
  })

  const seen = new Map<string, number>()
  const intraFileDupes: Array<{
    rowIndex: number
    address: string
    unit?: string
  }> = []
  for (const item of enriched) {
    const key = dedupeKeyFor(item.propertyKey, item.row.unit)
    const prior = seen.get(key)
    if (prior !== undefined) {
      intraFileDupes.push({
        rowIndex: item.idx + 2,
        address: item.row.address,
        unit: item.row.unit,
      })
    } else {
      seen.set(key, item.idx)
    }
  }

  const propertyKeys = enriched.map((e) => e.propertyKey)
  const existing = await db.property.findMany({
    where: { propertyKey: { in: propertyKeys } },
    select: { id: true, propertyKey: true, unit: true, address: true },
  })
  const existingIndex = new Map<string, { id: string; address: string }>()
  for (const e of existing) {
    existingIndex.set(dedupeKeyFor(e.propertyKey, e.unit), {
      id: e.id,
      address: e.address,
    })
  }

  if (dryRun) {
    const preview = enriched.map((item) => ({
      rowIndex: item.idx + 2,
      address: item.row.address,
      name: item.row.name,
      unit: item.row.unit,
      propertyType: item.row.propertyType,
      status: item.row.status ?? "active",
      squareFeet: item.row.squareFeet,
      listPrice: item.row.listPrice,
      propertyKey: item.propertyKey,
      action: existingIndex.has(dedupeKeyFor(item.propertyKey, item.row.unit))
        ? "update"
        : "create",
    }))
    return NextResponse.json({
      ok: true,
      dryRun: true,
      summary: {
        totalRows: enriched.length,
        toCreate: preview.filter((p) => p.action === "create").length,
        toUpdate: preview.filter((p) => p.action === "update").length,
        intraFileDupes: intraFileDupes.length,
        parseErrors: parsed.errors.length,
      },
      preview,
      intraFileDupes,
      parseErrors: parsed.errors,
    })
  }

  let created = 0
  let updated = 0
  const errors: Array<{ rowIndex: number; reason: string }> = []

  for (const item of enriched) {
    const existingRow = existingIndex.get(
      dedupeKeyFor(item.propertyKey, item.row.unit)
    )
    const status = (item.row.status ?? "active") as PropertyStatus

    const data: Prisma.PropertyUncheckedCreateInput = {
      address: item.row.address,
      ...(item.row.name ? { name: item.row.name } : {}),
      ...(item.row.unit ? { unit: item.row.unit } : {}),
      ...(item.row.city ? { city: item.row.city } : {}),
      ...(item.row.state ? { state: item.row.state } : {}),
      ...(item.row.zip ? { zip: item.row.zip } : {}),
      propertyKey: item.propertyKey,
      ...(item.row.propertyType
        ? { propertyType: item.row.propertyType as PropertyType }
        : {}),
      status,
      ...(item.row.squareFeet !== undefined
        ? { squareFeet: Math.round(item.row.squareFeet) }
        : {}),
      ...(item.row.occupiedSquareFeet !== undefined
        ? { occupiedSquareFeet: Math.round(item.row.occupiedSquareFeet) }
        : {}),
      ...(item.row.listPrice !== undefined
        ? { listPrice: item.row.listPrice }
        : {}),
      ...(item.row.capRate !== undefined ? { capRate: item.row.capRate } : {}),
      ...(item.row.listingUrl ? { listingUrl: item.row.listingUrl } : {}),
      ...(item.row.flyerUrl ? { flyerUrl: item.row.flyerUrl } : {}),
      ...(item.row.description ? { description: item.row.description } : {}),
      source: "csv_import",
      createdBy,
    }

    try {
      if (existingRow) {
        await db.property.update({
          where: { id: existingRow.id },
          data: {
            ...data,
            // Don't reset createdBy on update.
            createdBy: undefined,
          },
        })
        updated++
      } else {
        await db.property.create({ data })
        created++
      }
    } catch (error: unknown) {
      const reason =
        error && typeof error === "object" && "code" in error
          ? "prisma:" + (error as { code: string }).code
          : error instanceof Error
            ? error.message
            : "unknown error"
      errors.push({ rowIndex: item.idx + 2, reason })
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    summary: {
      totalRows: enriched.length,
      created,
      updated,
      errored: errors.length,
      intraFileDupes: intraFileDupes.length,
      parseErrors: parsed.errors.length,
    },
    errors,
    intraFileDupes,
    parseErrors: parsed.errors,
  })
}
