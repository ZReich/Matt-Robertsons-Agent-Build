import "server-only"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import { computePropertyKey, extractPropertyUnit } from "./property-utils"

/**
 * One-shot backfill that fixes property-collapse on existing Buildout-imported
 * Deals. Before the ingester learned about `extractPropertyUnit` (commit
 * 829eb7d), every suite in a multi-suite building collapsed onto a single
 * `Property` row keyed by `(propertyKey, unit=NULL)`. This helper walks the
 * existing Deals and reassigns each one to the canonical `(propertyKey, unit)`
 * Property — creating new Property rows on demand and updating any linked
 * `LeaseRecord`/`CalendarEvent` rows in the same transaction so the FK graph
 * stays consistent.
 *
 * Idempotency: re-running after success is a no-op because every Deal's
 * canonical `(propertyKey, unit)` will already match its current
 * `Property` and the orphan-archival pass will have already archived the
 * old collapsed parents.
 *
 * Designed to be called from the operator route at
 * `/api/lease/backfill-property-collapse`. NOT exposed to user-facing flows.
 */

const CREATED_BY = "property-collapse-backfill"
const DEAL_CREATED_BY = "buildout-csv-import"
const BUILDOUT_SOURCE = "buildout_import"

export interface BackfillOptions {
  /** When true, compute every reassignment but write nothing. */
  dryRun?: boolean
  /** Process at most this many deals. */
  limit?: number
  /** Throttle between deals in ms. Default 50. */
  throttleMs?: number
  /** Stop after this many consecutive errors. Default 5. */
  maxConsecutiveErrors?: number
  /** Override the database client (for tests). */
  prisma?: typeof db
  /** Override the throttle helper (for tests). */
  sleep?: (ms: number) => Promise<void>
}

export interface DealReassignment {
  dealId: string
  fromPropertyId: string | null
  toPropertyId: string
  propertyKey: string
  unit: string | null
  /** True if `toPropertyId` was created in this run. */
  createdNewProperty: boolean
  leaseRecordsUpdated: number
  calendarEventsUpdated: number
}

export interface ArchivedProperty {
  propertyId: string
  propertyKey: string
  address: string
  unit: string | null
  remainingDealCount: number
}

export interface BackfillReport {
  ok: boolean
  dryRun: boolean
  dealsConsidered: number
  dealsReassigned: number
  dealsAlreadyCanonical: number
  propertiesCreated: number
  propertiesArchived: number
  errors: Array<{ dealId?: string; propertyId?: string; reason: string }>
  reassignments: DealReassignment[]
  archived: ArchivedProperty[]
  stoppedEarlyReason?: string
}

interface DealRow {
  id: string
  propertyId: string | null
  propertyAddress: string | null
  city: string | null
  state: string | null
  property: { city: string | null; state: string | null } | null
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function runPropertyCollapseBackfill(
  options: BackfillOptions = {}
): Promise<BackfillReport> {
  const dryRun = options.dryRun === true
  const throttleMs =
    typeof options.throttleMs === "number" && options.throttleMs >= 0
      ? options.throttleMs
      : 50
  const maxConsecutiveErrors = options.maxConsecutiveErrors ?? 5
  const sleep = options.sleep ?? defaultSleep
  const prisma = options.prisma ?? db

  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? options.limit
      : undefined

  const report: BackfillReport = {
    ok: true,
    dryRun,
    dealsConsidered: 0,
    dealsReassigned: 0,
    dealsAlreadyCanonical: 0,
    propertiesCreated: 0,
    propertiesArchived: 0,
    errors: [],
    reassignments: [],
    archived: [],
  }

  const deals = await prisma.deal.findMany({
    where: { createdBy: DEAL_CREATED_BY },
    select: {
      id: true,
      propertyId: true,
      propertyAddress: true,
      // `Deal.propertyAddress` is the raw deal title from Buildout (e.g.
      // "303 N Broadway | Suite 200"). We re-derive the canonical key from
      // it the same way the ingester does.
      property: {
        select: { city: true, state: true },
      },
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  })

  report.dealsConsidered = deals.length

  let consecutiveErrors = 0

  for (const dealRaw of deals) {
    const deal: DealRow = {
      id: dealRaw.id,
      propertyId: dealRaw.propertyId,
      propertyAddress: dealRaw.propertyAddress,
      // Deal table doesn't carry city/state directly — they live on Property.
      city: dealRaw.property?.city ?? null,
      state: dealRaw.property?.state ?? null,
      property: dealRaw.property,
    }

    if (!deal.propertyAddress || !deal.propertyAddress.trim()) {
      // Nothing to canonicalize against — leave it.
      report.dealsAlreadyCanonical += 1
      continue
    }

    try {
      const result = await processDeal(prisma, deal, dryRun)
      if (result.kind === "noop") {
        report.dealsAlreadyCanonical += 1
      } else {
        report.dealsReassigned += 1
        if (result.createdNewProperty) report.propertiesCreated += 1
        report.reassignments.push(result.reassignment)
      }
      consecutiveErrors = 0
    } catch (err) {
      consecutiveErrors += 1
      report.errors.push({
        dealId: deal.id,
        reason: err instanceof Error ? err.message : String(err),
      })
      if (consecutiveErrors >= maxConsecutiveErrors) {
        report.ok = false
        report.stoppedEarlyReason = `aborted after ${maxConsecutiveErrors} consecutive errors`
        return report
      }
    }

    if (throttleMs > 0) {
      await sleep(throttleMs)
    }
  }

  // Orphan-archival pass — only after every deal has been reassigned, so
  // we don't archive a Property a later deal would still need.
  try {
    const orphans = await findOrphanCollapsedProperties(prisma)
    for (const orphan of orphans) {
      if (!dryRun) {
        await prisma.property.update({
          where: { id: orphan.propertyId },
          data: { archivedAt: new Date() },
        })
      }
      report.propertiesArchived += 1
      report.archived.push(orphan)
    }
  } catch (err) {
    report.ok = false
    report.errors.push({
      reason: `orphan archival pass failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    })
  }

  return report
}

interface ProcessResult {
  kind: "noop" | "reassigned"
  createdNewProperty: boolean
  reassignment: DealReassignment
}

async function processDeal(
  prisma: typeof db,
  deal: DealRow,
  dryRun: boolean
): Promise<ProcessResult> {
  const addressCandidate = (deal.propertyAddress ?? "").trim()
  const propertyKey = computePropertyKey({
    address: addressCandidate,
    city: deal.city ?? undefined,
    state: deal.state ?? undefined,
  })
  const unit = extractPropertyUnit(addressCandidate)

  // If the deal already points to a Property whose (propertyKey, unit) match,
  // we're already canonical.
  if (deal.propertyId) {
    const current = await prisma.property.findUnique({
      where: { id: deal.propertyId },
      select: { propertyKey: true, unit: true },
    })
    if (
      current &&
      current.propertyKey === propertyKey &&
      (current.unit ?? null) === (unit ?? null)
    ) {
      return {
        kind: "noop",
        createdNewProperty: false,
        reassignment: {
          dealId: deal.id,
          fromPropertyId: deal.propertyId,
          toPropertyId: deal.propertyId,
          propertyKey,
          unit,
          createdNewProperty: false,
          leaseRecordsUpdated: 0,
          calendarEventsUpdated: 0,
        },
      }
    }
  }

  // Find or create the canonical Property + perform the reassignment in one
  // atomic step. We use a per-deal transaction so a partial failure doesn't
  // leave LeaseRecords pointing at the old Property while the Deal points at
  // the new one.
  const txnFn = async (
    tx: Prisma.TransactionClient
  ): Promise<{
    toPropertyId: string
    createdNewProperty: boolean
    leaseRecordsUpdated: number
    calendarEventsUpdated: number
  }> => {
    let target = await tx.property.findFirst({
      where: { propertyKey, unit: unit ?? null },
      select: {
        id: true,
        propertyType: true,
        squareFeet: true,
        listingUrl: true,
        flyerUrl: true,
      },
    })

    let createdNewProperty = false
    if (!target) {
      // Borrow address/city/state/propertyType from the old Property when
      // available so we keep the catalog usable.
      const oldProp = deal.propertyId
        ? await tx.property.findUnique({
            where: { id: deal.propertyId },
            select: {
              address: true,
              city: true,
              state: true,
              zip: true,
              propertyType: true,
            },
          })
        : null

      const created = await tx.property.create({
        data: {
          address: (oldProp?.address ?? addressCandidate).slice(0, 250),
          ...(unit ? { unit } : {}),
          ...(oldProp?.city ? { city: oldProp.city } : {}),
          ...(oldProp?.state ? { state: oldProp.state } : {}),
          ...(oldProp?.zip ? { zip: oldProp.zip } : {}),
          propertyKey,
          ...(oldProp?.propertyType
            ? { propertyType: oldProp.propertyType }
            : {}),
          status: "active",
          source: BUILDOUT_SOURCE,
          tags: ["buildout-import", "split-from-collapse"],
          createdBy: CREATED_BY,
        },
        select: {
          id: true,
          propertyType: true,
          squareFeet: true,
          listingUrl: true,
          flyerUrl: true,
        },
      })
      target = created
      createdNewProperty = true
    }

    // Update Deal.propertyId
    await tx.deal.update({
      where: { id: deal.id },
      data: { propertyId: target.id },
    })

    // Update linked LeaseRecord rows
    const lrUpdate = await tx.leaseRecord.updateMany({
      where: { dealId: deal.id },
      data: { propertyId: target.id },
    })

    // Update linked CalendarEvent rows
    const ceUpdate = await tx.calendarEvent.updateMany({
      where: { dealId: deal.id },
      data: { propertyId: target.id },
    })

    return {
      toPropertyId: target.id,
      createdNewProperty,
      leaseRecordsUpdated: lrUpdate.count,
      calendarEventsUpdated: ceUpdate.count,
    }
  }

  const txnResult = dryRun
    ? await simulateTransaction(
        prisma,
        propertyKey,
        unit,
        deal,
        addressCandidate
      )
    : await prisma.$transaction(txnFn)

  return {
    kind: "reassigned",
    createdNewProperty: txnResult.createdNewProperty,
    reassignment: {
      dealId: deal.id,
      fromPropertyId: deal.propertyId,
      toPropertyId: txnResult.toPropertyId,
      propertyKey,
      unit,
      createdNewProperty: txnResult.createdNewProperty,
      leaseRecordsUpdated: txnResult.leaseRecordsUpdated,
      calendarEventsUpdated: txnResult.calendarEventsUpdated,
    },
  }
}

/**
 * Dry-run analogue of the per-deal transaction. Performs reads only — no
 * writes — and returns the same shape `txnFn` returns so the caller can
 * report what WOULD have happened.
 */
async function simulateTransaction(
  prisma: typeof db,
  propertyKey: string,
  unit: string | null,
  deal: DealRow,
  _addressCandidate: string
): Promise<{
  toPropertyId: string
  createdNewProperty: boolean
  leaseRecordsUpdated: number
  calendarEventsUpdated: number
}> {
  const target = await prisma.property.findFirst({
    where: { propertyKey, unit: unit ?? null },
    select: { id: true },
  })

  const lrCount = await prisma.leaseRecord.count({
    where: { dealId: deal.id, propertyId: { not: null } },
  })
  const ceCount = await prisma.calendarEvent.count({
    where: { dealId: deal.id, propertyId: { not: null } },
  })

  if (target) {
    return {
      toPropertyId: target.id,
      createdNewProperty: false,
      leaseRecordsUpdated: lrCount,
      calendarEventsUpdated: ceCount,
    }
  }

  return {
    // Stable placeholder so a dry-run report can group multiple deals that
    // would land on the same NEW Property.
    toPropertyId: `(would-create:${propertyKey}|${unit ?? ""})`,
    createdNewProperty: true,
    leaseRecordsUpdated: lrCount,
    calendarEventsUpdated: ceCount,
  }
}

/**
 * Find buildout-imported Properties with no remaining Deal references. These
 * are the old "collapsed" rows whose deals have all been reassigned to
 * canonical (`propertyKey`, `unit`) Properties.
 */
async function findOrphanCollapsedProperties(
  prisma: typeof db
): Promise<ArchivedProperty[]> {
  const candidates = await prisma.property.findMany({
    where: {
      source: BUILDOUT_SOURCE,
      archivedAt: null,
    },
    select: {
      id: true,
      propertyKey: true,
      address: true,
      unit: true,
      _count: { select: { deals: true } },
    },
  })

  const out: ArchivedProperty[] = []
  for (const c of candidates) {
    if (c._count.deals === 0) {
      out.push({
        propertyId: c.id,
        propertyKey: c.propertyKey,
        address: c.address,
        unit: c.unit,
        remainingDealCount: 0,
      })
    }
  }
  return out
}
