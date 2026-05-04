import { NextResponse } from "next/server"

import type { ScanMissingDealRow } from "@/lib/lease/lease-end-date-scanner"

import { scanMissingLeaseEndDates } from "@/lib/lease/lease-end-date-scanner"
import { constantTimeCompare } from "@/lib/msgraph/constant-time-compare"
import { db } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Operator-only endpoint to backfill `LeaseRecord.leaseEndDate` for the
 * ~93 closed lease deals that came out of Buildout's CSV without one.
 *
 * Auth: `x-admin-token: $MSGRAPH_TEST_ADMIN_TOKEN`. Mirrors the gate at
 * `process-backlog/route.ts` and the `daily-listings/process` route.
 *
 * Body shape (all optional):
 *   - dealRows: explicit `ScanMissingDealRow[]` to scan. When omitted,
 *     the route auto-builds the list by querying Deals with
 *     stage='closed' AND a missing/incomplete LeaseRecord.
 *   - maxMessagesPerDeal, maxPdfsPerDeal, throttleMs: pass-through
 *     scanner caps.
 */
function isOperatorTokenAuthorized(req: Request): boolean {
  const expected = process.env.MSGRAPH_TEST_ADMIN_TOKEN ?? ""
  if (!expected) return false
  const provided = req.headers.get("x-admin-token") ?? ""
  return provided.length > 0 && constantTimeCompare(provided, expected)
}

interface RawDealRow {
  dealId?: unknown
  buildoutDealId?: unknown
  dealName?: unknown
  searchTerms?: unknown
  existingLeaseRecordId?: unknown
  contactId?: unknown
  propertyId?: unknown
  closeDate?: unknown
  expectedDealKind?: unknown
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string" && x.length > 0)
}

function parseDealRow(raw: RawDealRow): ScanMissingDealRow | null {
  const dealId = asString(raw.dealId)
  if (!dealId) return null
  const searchTerms = asStringArray(raw.searchTerms)
  if (searchTerms.length === 0) return null
  const closeDateRaw = asString(raw.closeDate)
  const closeDate = closeDateRaw ? new Date(closeDateRaw) : null
  const expectedDealKind = raw.expectedDealKind === "sale" ? "sale" : "lease"
  return {
    dealId,
    buildoutDealId: asString(raw.buildoutDealId),
    dealName: asString(raw.dealName) ?? "(unnamed deal)",
    searchTerms,
    existingLeaseRecordId: asString(raw.existingLeaseRecordId),
    contactId: asString(raw.contactId),
    propertyId: asString(raw.propertyId),
    closeDate:
      closeDate && !Number.isNaN(closeDate.getTime()) ? closeDate : null,
    expectedDealKind,
  }
}

/**
 * Build search terms from a deal title like
 * `"303 N Broadway | Suite 200"` → `["303 N Broadway"]`.
 *
 * Strategy:
 *   - Split on `|`, take parts that look address-like (>= 5 chars, has a digit).
 *   - Drop standalone "Suite N" / "Unit N" suffixes.
 *   - Add the property's address1 if available.
 */
function buildSearchTermsForDeal(deal: {
  propertyAddress: string | null
  property: { address: string | null; city: string | null } | null
}): string[] {
  const candidates: string[] = []
  const title = deal.propertyAddress ?? ""
  for (const part of title.split("|")) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (/^(suite|ste|unit|apt|#)\b/i.test(trimmed)) continue
    if (trimmed.length >= 5 && /\d/.test(trimmed)) {
      candidates.push(trimmed)
    }
  }
  if (deal.property?.address) {
    const a1 = deal.property.address.trim()
    if (a1.length >= 5) candidates.push(a1)
  }
  return Array.from(new Set(candidates))
}

async function buildDefaultDealRows(): Promise<ScanMissingDealRow[]> {
  // Closed deals where the LeaseRecord is missing or has a null end date.
  const deals = await db.deal.findMany({
    where: {
      stage: "closed",
      OR: [
        { leaseRecords: { none: {} } },
        { leaseRecords: { some: { leaseEndDate: null } } },
      ],
    },
    include: {
      property: { select: { address: true, city: true } },
      leaseRecords: {
        select: { id: true, leaseEndDate: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  const rows: ScanMissingDealRow[] = []
  for (const d of deals) {
    const searchTerms = buildSearchTermsForDeal(d)
    if (searchTerms.length === 0) continue
    const existing = d.leaseRecords[0] ?? null
    rows.push({
      dealId: d.id,
      buildoutDealId: d.buildoutDealId,
      dealName: d.propertyAddress ?? "(unnamed deal)",
      searchTerms,
      existingLeaseRecordId: existing?.id ?? null,
      contactId: d.contactId,
      propertyId: d.propertyId,
      closeDate: d.closedAt,
      expectedDealKind: "lease",
    })
  }
  return rows
}

export async function POST(req: Request): Promise<Response> {
  if (!isOperatorTokenAuthorized(req)) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized" },
      { status: 401 }
    )
  }

  let body: {
    dealRows?: unknown
    maxMessagesPerDeal?: unknown
    maxPdfsPerDeal?: unknown
    throttleMs?: unknown
  } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  let dealRows: ScanMissingDealRow[]
  if (Array.isArray(body.dealRows)) {
    dealRows = (body.dealRows as RawDealRow[])
      .map(parseDealRow)
      .filter((r): r is ScanMissingDealRow => r !== null)
  } else {
    dealRows = await buildDefaultDealRows()
  }

  const maxMessagesPerDeal =
    typeof body.maxMessagesPerDeal === "number" &&
    Number.isFinite(body.maxMessagesPerDeal)
      ? body.maxMessagesPerDeal
      : undefined
  const maxPdfsPerDeal =
    typeof body.maxPdfsPerDeal === "number" &&
    Number.isFinite(body.maxPdfsPerDeal)
      ? body.maxPdfsPerDeal
      : undefined
  const throttleMs =
    typeof body.throttleMs === "number" && Number.isFinite(body.throttleMs)
      ? body.throttleMs
      : undefined

  const result = await scanMissingLeaseEndDates({
    dealRows,
    maxMessagesPerDeal,
    maxPdfsPerDeal,
    throttleMs,
  })

  return NextResponse.json({
    ok: true,
    dealsConsidered: dealRows.length,
    ...result,
  })
}

export async function GET(): Promise<Response> {
  return new NextResponse(null, { status: 405 })
}
