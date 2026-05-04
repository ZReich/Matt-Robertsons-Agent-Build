import "server-only"

import type {
  Contact,
  DealStage,
  DealOutcome,
  DealType,
  PropertyType,
} from "@prisma/client"
import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import {
  computePropertyKey,
  extractPropertyUnit,
} from "@/lib/properties/property-utils"

/**
 * Buildout Deal Pipeline Report CSV ingest.
 *
 * Source: Matt's Buildout export ("deal_pipeline_report.csv"). Columns are
 * a fixed 32-field shape — see `EXPECTED_HEADERS`. Each row represents one
 * deal in Buildout, the truth source for transactional history going back
 * to 2018.
 *
 * What the ingest does per row:
 *   1. Resolve or create the seller/landlord Contact (by email if present,
 *      else by canonical name + company).
 *   2. Resolve or create the buyer/tenant Contact (same lookup).
 *   3. Resolve or create the Property catalog row using "Deal Name" /
 *      "Deal Title" + city + state. Deal Name is often a full address
 *      ("303 N Broadway"), sometimes a business name ("Electric City Eyes,
 *      PLLC") — we fall back to the raw string when it doesn't parse.
 *   4. UPSERT the Deal row keyed on `buildoutDealId` (so re-runs are
 *      idempotent and update existing rows in place).
 *   5. For lease deals (Deal Type contains "Lease" or "Tenant Rep") with
 *      a populated Lease Expiration date, create a LeaseRecord — this is
 *      what drives the renewal alert sweep.
 *
 * Idempotency: every Deal is keyed on `buildoutDealId`. Re-runs upsert.
 *
 * The ingest is OPERATOR-DRIVEN — call it from the admin-token-gated route
 * at `POST /api/integrations/buildout/import-deal-csv`. There's no cron.
 */

const EXPECTED_HEADERS = [
  "Deal ID",
  "Deal Name",
  "Stage",
  "Deal Type",
  "Property Type",
  "City",
  "State",
  "Deal Title",
  "Close Probability",
  "Seller / Landlord",
  "Seller Name",
  "Seller Company Name",
  "Seller Email",
  "Seller Phone",
  "Buyer / Tenant",
  "Buyer Name",
  "Buyer Company Name",
  "Buyer Email",
  "Buyer Phone",
  "Building Size (SF)",
  "Space Size (SF)",
  "Lot Size (AC)",
  "Close Date",
  "Contract / LOI Executed",
  "Lease Start",
  "Lease Expiration",
  "Renewal Option Notice",
  "Lease Type",
  "Transaction Value",
  "Lease Term (Months)",
  "Average Lease Rate",
  "Due Diligence Release Date",
] as const

interface BuildoutDealRow {
  dealId: string
  dealName: string
  stage: string
  dealType: string
  propertyType: string
  city: string
  state: string
  dealTitle: string
  closeProbability: number | null
  sellerLandlord: string
  sellerName: string
  sellerCompany: string
  sellerEmail: string
  sellerPhone: string
  buyerTenant: string
  buyerName: string
  buyerCompany: string
  buyerEmail: string
  buyerPhone: string
  buildingSizeSf: number | null
  spaceSizeSf: number | null
  lotSizeAc: number | null
  closeDate: Date | null
  contractLoiExecuted: Date | null
  leaseStart: Date | null
  leaseExpiration: Date | null
  renewalOptionNotice: string
  leaseType: string
  transactionValue: number | null
  leaseTermMonths: number | null
  averageLeaseRate: number | null
  dueDiligenceReleaseDate: Date | null
}

export interface IngestSummary {
  rowsParsed: number
  parseErrors: Array<{ rowIndex: number; reason: string }>
  contactsCreated: number
  contactsLinked: number
  propertiesCreated: number
  propertiesLinked: number
  dealsCreated: number
  dealsUpdated: number
  leaseRecordsCreated: number
  ingestErrors: Array<{ rowIndex: number; buildoutDealId: string; reason: string }>
}

export interface IngestOptions {
  dryRun?: boolean
}

const DEAL_STAGE_MAP: Record<string, DealStage> = {
  closed: "closed",
  dead: "closed",
  sourcing: "prospecting",
  evaluating: "prospecting",
  pitching: "prospecting",
  transacting: "under_contract",
  "under contract": "under_contract",
  "under-contract": "under_contract",
  "due diligence": "due_diligence",
  closing: "closing",
}

const PROPERTY_TYPE_MAP: Record<string, PropertyType> = {
  office: "office",
  retail: "retail",
  industrial: "industrial",
  multifamily: "multifamily",
  "multi-family": "multifamily",
  land: "land",
  "mixed use": "mixed_use",
  "mixed-use": "mixed_use",
  hospitality: "hospitality",
  hotel: "hospitality",
  medical: "medical",
}

const DEAL_TYPE_MAP: Record<string, DealType> = {
  lease: "seller_rep",
  sale: "seller_rep",
  "tenant rep": "tenant_rep",
  "buyer rep": "buyer_rep",
  consulting: "seller_rep", // best fit, never auto-fired
}

function parseCsvRecords(csv: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  let i = 0
  const text = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ",") {
      row.push(cell)
      cell = ""
      i++
      continue
    }
    if (ch === "\n") {
      row.push(cell)
      result.push(row)
      row = []
      cell = ""
      i++
      continue
    }
    cell += ch
    i++
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    result.push(row)
  }
  return result
}

function trimmed(v: string): string {
  return v.replace(/^\s+|\s+$/g, "")
}

/**
 * Buildout exports use literal placeholder strings for anonymized or
 * unknown parties. Treat them as empty so the resolver doesn't merge
 * hundreds of unrelated deals into a single shared "--" contact.
 */
const PLACEHOLDER_NULLS = new Set([
  "--",
  "—",
  "-",
  "n/a",
  "na",
  "none",
  "tbd",
  "unknown",
  "(see zach)",
])
function nullablePartyString(v: string): string {
  const t = trimmed(v)
  if (PLACEHOLDER_NULLS.has(t.toLowerCase())) return ""
  return t
}

function parseNumber(v: string): number | null {
  if (!v) return null
  const cleaned = v.replace(/[$,%\s]/g, "")
  if (cleaned.length === 0) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseInt32(v: string): number | null {
  const n = parseNumber(v)
  if (n === null) return null
  return Math.round(n)
}

function parseUSDate(v: string): Date | null {
  // Buildout exports M/D/YYYY (or MM/DD/YYYY).
  const trimmedVal = trimmed(v)
  if (!trimmedVal) return null
  const m = trimmedVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  const date = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    12,
    0,
    0,
    0
  )
  if (Number.isNaN(date.getTime())) return null
  return date
}

function parseRow(record: string[], rowIndex: number): BuildoutDealRow | null {
  if (record.length < EXPECTED_HEADERS.length) {
    // Allow trailing-empty rows
    if (record.every((c) => trimmed(c) === "")) return null
    return null
  }
  const get = (idx: number) => trimmed(record[idx] ?? "")
  const dealId = get(0)
  if (!dealId) return null
  return {
    dealId,
    dealName: get(1),
    stage: get(2),
    dealType: get(3),
    propertyType: get(4),
    city: get(5),
    state: get(6),
    dealTitle: get(7),
    closeProbability: parseNumber(get(8)),
    sellerLandlord: nullablePartyString(get(9)),
    sellerName: nullablePartyString(get(10)),
    sellerCompany: nullablePartyString(get(11)),
    sellerEmail: nullablePartyString(get(12)).toLowerCase(),
    sellerPhone: nullablePartyString(get(13)),
    buyerTenant: nullablePartyString(get(14)),
    buyerName: nullablePartyString(get(15)),
    buyerCompany: nullablePartyString(get(16)),
    buyerEmail: nullablePartyString(get(17)).toLowerCase(),
    buyerPhone: nullablePartyString(get(18)),
    buildingSizeSf: parseInt32(get(19)),
    spaceSizeSf: parseInt32(get(20)),
    lotSizeAc: parseNumber(get(21)),
    closeDate: parseUSDate(get(22)),
    contractLoiExecuted: parseUSDate(get(23)),
    leaseStart: parseUSDate(get(24)),
    leaseExpiration: parseUSDate(get(25)),
    renewalOptionNotice: get(26),
    leaseType: get(27),
    transactionValue: parseNumber(get(28)),
    leaseTermMonths: parseInt32(get(29)),
    averageLeaseRate: parseNumber(get(30)),
    dueDiligenceReleaseDate: parseUSDate(get(31)),
  }
}

interface ResolveContactInput {
  email: string
  name: string
  companyName: string
  phone: string
}

async function resolveOrCreateContact(
  tx: Prisma.TransactionClient,
  input: ResolveContactInput,
  createdBy: string
): Promise<{ contact: Contact; created: boolean } | null> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  const company = input.companyName.trim()
  const phone = input.phone.replace(/[^0-9+]/g, "").trim()

  if (!email && !name && !company) return null

  // Lookup priority: email → name+company → name only
  let existing: Contact | null = null
  if (email) {
    existing = await tx.contact.findFirst({
      where: { email, archivedAt: null },
    })
  }
  if (!existing && name && company) {
    existing = await tx.contact.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        company: { equals: company, mode: "insensitive" },
        archivedAt: null,
      },
    })
  }
  if (!existing && name) {
    existing = await tx.contact.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        archivedAt: null,
      },
    })
  }
  if (existing) return { contact: existing, created: false }

  const displayName = name || company || email
  if (!displayName) return null
  const created = await tx.contact.create({
    data: {
      name: displayName,
      ...(company ? { company } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      tags: ["buildout-import"],
      createdBy,
    },
  })
  return { contact: created, created: true }
}

interface ResolvePropertyInput {
  dealName: string
  dealTitle: string
  city: string
  state: string
  propertyType: PropertyType | null
  buildingSizeSf: number | null
}

async function resolveOrCreateProperty(
  tx: Prisma.TransactionClient,
  input: ResolvePropertyInput,
  createdBy: string
): Promise<{ id: string; created: boolean } | null> {
  // Best address candidate: dealTitle if present, else dealName.
  const addressCandidate = (input.dealTitle || input.dealName).trim()
  if (!addressCandidate) return null
  const propertyKey = computePropertyKey({
    address: addressCandidate,
    city: input.city,
    state: input.state,
  })
  // Extract unit/suite from the deal title so multi-suite buildings
  // ("West Park Promenade | Unit 110", "1601 Lewis | Suite 104") dedupe to
  // distinct Property rows. Without this, every suite collapses onto a single
  // Property and the @@unique([propertyKey, unit]) constraint forces the
  // ingest to either reuse the wrong row or throw on create.
  const unit = extractPropertyUnit(addressCandidate)

  const existing = await tx.property.findFirst({
    where: { propertyKey, unit: unit ?? null },
  })
  if (existing) return { id: existing.id, created: false }

  const created = await tx.property.create({
    data: {
      address: addressCandidate.slice(0, 250),
      ...(unit ? { unit } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.state ? { state: input.state } : {}),
      propertyKey,
      ...(input.propertyType ? { propertyType: input.propertyType } : {}),
      ...(input.buildingSizeSf ? { squareFeet: input.buildingSizeSf } : {}),
      status: "active",
      source: "buildout_import",
      tags: ["buildout-import"],
      createdBy,
    },
  })
  return { id: created.id, created: true }
}

function mapStage(stage: string): DealStage {
  const lookup = DEAL_STAGE_MAP[stage.trim().toLowerCase()]
  return lookup ?? "prospecting"
}

function mapDealOutcome(stage: string): DealOutcome | null {
  const s = stage.trim().toLowerCase()
  if (s === "closed") return "won"
  if (s === "dead") return "lost"
  return null
}

function mapPropertyType(t: string): PropertyType | null {
  return PROPERTY_TYPE_MAP[t.trim().toLowerCase()] ?? null
}

function mapDealType(t: string): DealType {
  const lookup = DEAL_TYPE_MAP[t.trim().toLowerCase()]
  return lookup ?? "seller_rep"
}

function isLeaseDeal(row: BuildoutDealRow): boolean {
  // Strictly by deal type. Sales should NOT be classified as leases just
  // because they happen to carry a Lease Expiration in the CSV (rare data
  // entry quirk). The dealKind column on LeaseRecord disambiguates lease
  // vs sale; we use the same flag to drive that.
  const t = row.dealType.toLowerCase()
  return t === "lease" || t === "tenant rep"
}

function isClosedStage(row: BuildoutDealRow): boolean {
  return row.stage.trim().toLowerCase() === "closed"
}

function addMonthsUtc(start: Date, months: number): Date {
  // Use UTC arithmetic to match the orchestrator's date semantics.
  const d = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 12)
  )
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

function deriveLeaseEndDate(row: BuildoutDealRow): Date | null {
  if (row.leaseExpiration) return row.leaseExpiration
  if (row.leaseStart && row.leaseTermMonths && row.leaseTermMonths > 0) {
    return addMonthsUtc(row.leaseStart, row.leaseTermMonths)
  }
  return null
}

export async function ingestBuildoutDealCsv(
  csv: string,
  options: IngestOptions = {}
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    rowsParsed: 0,
    parseErrors: [],
    contactsCreated: 0,
    contactsLinked: 0,
    propertiesCreated: 0,
    propertiesLinked: 0,
    dealsCreated: 0,
    dealsUpdated: 0,
    leaseRecordsCreated: 0,
    ingestErrors: [],
  }

  const records = parseCsvRecords(csv)
  if (records.length === 0) return summary
  const headers = records[0].map(trimmed)
  // Sanity-check the first 5 headers — if they're wrong this isn't a Buildout
  // deal export.
  if (
    headers[0]?.toLowerCase() !== "deal id" ||
    headers[1]?.toLowerCase() !== "deal name"
  ) {
    summary.parseErrors.push({
      rowIndex: 1,
      reason: `unexpected headers — expected "Deal ID, Deal Name, ..." got "${headers.slice(0, 4).join(", ")}"`,
    })
    return summary
  }

  for (let i = 1; i < records.length; i++) {
    const record = records[i]
    if (record.length === 0 || record.every((c) => trimmed(c) === "")) continue
    const row = parseRow(record, i + 1)
    if (!row) {
      summary.parseErrors.push({
        rowIndex: i + 1,
        reason: `row could not be parsed (got ${record.length} fields)`,
      })
      continue
    }
    summary.rowsParsed++

    if (options.dryRun) continue

    try {
      await db.$transaction(async (tx) => {
        const sellerInput: ResolveContactInput = {
          email: row.sellerEmail,
          name: row.sellerName || row.sellerLandlord,
          companyName: row.sellerCompany,
          phone: row.sellerPhone,
        }
        const buyerInput: ResolveContactInput = {
          email: row.buyerEmail,
          name: row.buyerName || row.buyerTenant,
          companyName: row.buyerCompany,
          phone: row.buyerPhone,
        }

        const seller = await resolveOrCreateContact(
          tx,
          sellerInput,
          "buildout-csv-import"
        )
        const buyer = await resolveOrCreateContact(
          tx,
          buyerInput,
          "buildout-csv-import"
        )

        if (seller?.created) summary.contactsCreated++
        else if (seller) summary.contactsLinked++
        if (buyer?.created) summary.contactsCreated++
        else if (buyer) summary.contactsLinked++

        // Pick the canonical Contact for the Deal.contactId. For listing-side
        // (Lease/Sale where Matt represents seller), the seller is canonical.
        // For tenant-rep / buyer-rep, the buyer/tenant is canonical.
        const dealTypeLower = row.dealType.toLowerCase()
        const mattRepresented =
          dealTypeLower === "tenant rep"
            ? "tenant"
            : dealTypeLower === "buyer rep"
              ? "tenant"
              : "owner"
        const canonicalContact =
          mattRepresented === "tenant" ? buyer?.contact : seller?.contact

        if (!canonicalContact) {
          throw new Error(
            `unresolvable_contact: deal "${row.dealName}" had no usable seller or buyer party (both were placeholder NULLs in the CSV: --, n/a, etc.)`
          )
        }

        const propertyType = mapPropertyType(row.propertyType)
        const property = await resolveOrCreateProperty(
          tx,
          {
            dealName: row.dealName,
            dealTitle: row.dealTitle,
            city: row.city,
            state: row.state,
            propertyType,
            buildingSizeSf: row.buildingSizeSf,
          },
          "buildout-csv-import"
        )
        if (property?.created) summary.propertiesCreated++
        else if (property) summary.propertiesLinked++

        if (!property?.id) {
          throw new Error(
            `unresolvable_property: deal "${row.dealName}" had no addressable property (Deal Title and Deal Name both empty)`
          )
        }

        const dealStage = mapStage(row.stage)
        const dealOutcome = mapDealOutcome(row.stage)
        const dealType = mapDealType(row.dealType)
        const dealData: Prisma.DealUncheckedCreateInput = {
          contactId: canonicalContact.id,
          buildoutDealId: row.dealId,
          dealType,
          dealSource: "manual",
          stage: dealStage,
          ...(dealOutcome ? { outcome: dealOutcome } : {}),
          ...(row.dealTitle || row.dealName
            ? { propertyAddress: (row.dealTitle || row.dealName).slice(0, 250) }
            : {}),
          ...(propertyType ? { propertyType } : {}),
          ...(row.buildingSizeSf ? { squareFeet: row.buildingSizeSf } : {}),
          ...(row.transactionValue !== null
            ? { value: row.transactionValue }
            : {}),
          ...(row.closeDate ? { closedAt: row.closeDate } : {}),
          ...(row.closeDate ? { closingDate: row.closeDate } : {}),
          ...(row.contractLoiExecuted
            ? { listedDate: row.contractLoiExecuted }
            : {}),
          ...(row.closeProbability !== null
            ? { probability: Math.min(100, Math.round(row.closeProbability)) }
            : {}),
          ...(property ? { propertyId: property.id } : {}),
          notes:
            row.dealName !== row.dealTitle && row.dealName
              ? `Buildout deal name: ${row.dealName}`
              : null,
          createdBy: "buildout-csv-import",
        }

        const existingDeal = await tx.deal.findUnique({
          where: { buildoutDealId: row.dealId },
          select: { id: true },
        })

        let dealId: string
        if (existingDeal) {
          await tx.deal.update({
            where: { id: existingDeal.id },
            data: dealData,
          })
          dealId = existingDeal.id
          summary.dealsUpdated++
        } else {
          const created = await tx.deal.create({ data: dealData })
          dealId = created.id
          summary.dealsCreated++
        }

        // LeaseRecord write — closed deals only. Both leases AND sales get
        // a row (sales use dealKind="sale" with lease-only fields nulled).
        // CSV is the source of truth, so re-imports overwrite existing rows
        // rather than skipping.
        if (isClosedStage(row) && property?.id && canonicalContact) {
          const dealKind: "lease" | "sale" = isLeaseDeal(row) ? "lease" : "sale"
          const computedEnd = dealKind === "lease" ? deriveLeaseEndDate(row) : null
          const leaseStartDate = dealKind === "lease"
            ? (row.leaseStart ?? row.closeDate)
            : null
          const status = computedEnd && computedEnd < new Date()
            ? "expired"
            : "active"
          const propLabel = row.dealTitle || row.dealName || "property"

          const leaseData = {
            contactId: canonicalContact.id,
            propertyId: property.id,
            dealId,
            closeDate: row.closeDate,
            leaseStartDate,
            leaseEndDate: computedEnd,
            leaseTermMonths: dealKind === "lease" ? row.leaseTermMonths : null,
            rentAmount: dealKind === "lease" ? row.averageLeaseRate : null,
            rentPeriod: dealKind === "lease" ? "annual" : null,
            mattRepresented,
            dealKind,
            extractionConfidence: new Prisma.Decimal(1), // CSV is source of truth
            status,
            notes: row.leaseType ? `Lease type: ${row.leaseType}` : null,
            createdBy: "buildout-csv-import",
          } satisfies Prisma.LeaseRecordUncheckedUpdateInput

          const existingLease = await tx.leaseRecord.findFirst({
            where: { dealId, archivedAt: null },
            select: { id: true },
          })

          let leaseRecordId: string
          if (existingLease) {
            await tx.leaseRecord.update({
              where: { id: existingLease.id },
              data: leaseData,
            })
            leaseRecordId = existingLease.id
          } else {
            const created = await tx.leaseRecord.create({
              data: leaseData as Prisma.LeaseRecordUncheckedCreateInput,
              select: { id: true },
            })
            leaseRecordId = created.id
            summary.leaseRecordsCreated++
          }

          // Mirror lease end date as a CalendarEvent. Only for leases with
          // a known end date; sales never trigger renewal alerts.
          // Upsert keyed on (leaseRecordId, eventKind="lease_renewal") so
          // re-imports update the date if it changed.
          if (dealKind === "lease" && computedEnd) {
            const eventData = {
              title: `Lease ends: ${propLabel}`,
              description: `${canonicalContact.name} lease at ${propLabel} expires.`,
              startDate: computedEnd,
              eventKind: "lease_renewal",
              contactId: canonicalContact.id,
              propertyId: property.id,
              dealId,
              leaseRecordId,
              source: "system",
              status: "upcoming",
              createdBy: "buildout-csv-import",
            } satisfies Prisma.CalendarEventUncheckedUpdateInput

            const existingEvent = await tx.calendarEvent.findFirst({
              where: { leaseRecordId, eventKind: "lease_renewal" },
              select: { id: true },
            })
            if (existingEvent) {
              await tx.calendarEvent.update({
                where: { id: existingEvent.id },
                data: eventData,
              })
            } else {
              await tx.calendarEvent.create({
                data: eventData as Prisma.CalendarEventUncheckedCreateInput,
              })
            }
          }
        }
      })
    } catch (error) {
      summary.ingestErrors.push({
        rowIndex: i + 1,
        buildoutDealId: row.dealId,
        reason: error instanceof Error ? error.message : "unknown",
      })
    }
  }

  if (summary.ingestErrors.length > 0) {
    const byReason = bucketByErrorPrefix(summary.ingestErrors.map((e) => e.reason))
    console.warn(
      `[buildout-csv-import] ${summary.ingestErrors.length} ingest errors:`,
      byReason
    )
  }

  return summary
}

/**
 * Groups error message strings by the prefix before the first colon.
 * E.g. "unresolvable_contact: ..." → { unresolvable_contact: N }
 * Errors with no colon prefix fall into "other".
 */
export function bucketByErrorPrefix(
  reasons: string[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const reason of reasons) {
    const colonIdx = reason.indexOf(":")
    const key = colonIdx > 0 ? reason.slice(0, colonIdx) : "other"
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}
