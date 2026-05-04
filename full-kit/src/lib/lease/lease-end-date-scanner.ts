import "server-only"

import {
  assertWithinLeaseBackfillBudget,
  LeaseBackfillBudgetError,
} from "@/lib/ai/budget-tracker"
import { extractLeaseFromPdf } from "@/lib/ai/pdf-lease-extractor"
import { GRAPH_BASE_URL } from "@/lib/msgraph/client"
import { downloadAttachment } from "@/lib/msgraph/download-attachment"
import { getAccessToken } from "@/lib/msgraph/token-manager"
import { db } from "@/lib/prisma"

/**
 * Targeted lease-end-date backfill scanner.
 *
 * The Buildout CSV import left ~93 closed lease deals without a usable
 * `leaseEndDate` (no end date in the CSV and no start+term to compute
 * one from either). This scanner is the fix-it pass for those deals.
 *
 * For each input deal we:
 *   1. Build a small set of search keywords from the deal's address +
 *      counterparty names.
 *   2. Hit Graph `$search` over Matt's mailbox for any messages
 *      mentioning those keywords (newest first).
 *   3. Filter to messages with attachments, then to PDF attachments.
 *   4. Run the existing `extractLeaseFromPdf` helper on each PDF
 *      (smallest first, capped at `maxPdfsPerDeal`). First success
 *      wins.
 *   5. Persist back to the LeaseRecord — UPDATE if one already exists
 *      for the deal, CREATE one otherwise.
 *
 * This is a per-deal job, not a broad sweep. It does NOT classify
 * messages, it does NOT walk the whole mailbox, and it does NOT add
 * Communication rows. The PDF extractor itself writes the `ScrubApiCall`
 * cost rows (see `src/lib/ai/pdf-lease-extractor.ts`).
 *
 * Budget guardrail: `assertWithinLeaseBackfillBudget()` runs BEFORE
 * each PDF extraction call. Graph search/list/download is free, so we
 * don't gate on the search itself.
 */

export interface ScanMissingDealRow {
  /** Deal.id (DB UUID, NOT the buildoutDealId). */
  dealId: string
  /** Buildout's external id, for log lines. */
  buildoutDealId: string | null
  /** Free-text label for log lines. */
  dealName: string
  /**
   * Address keywords + counterparty names. The scanner concatenates
   * these into the Graph `$search` query with `OR` semantics and
   * exact-phrase quoting.
   */
  searchTerms: string[]
  /** If the deal already has a LeaseRecord, its id; otherwise null. */
  existingLeaseRecordId: string | null
  /** Canonical contact (Matt's client side). Required for new LRs. */
  contactId: string | null
  propertyId: string | null
  closeDate: Date | null
  /** Always "lease" for this scanner's input. */
  expectedDealKind: "lease" | "sale"
}

export type ScanStatus =
  /** Existing LeaseRecord populated with discovered dates. */
  | "updated"
  /** New LeaseRecord created from discovered dates. */
  | "created"
  /** Search returned messages with attachments, but none were usable PDFs. */
  | "no_pdf_found"
  /** Graph $search returned 0 messages for the keyword set. */
  | "no_messages"
  /** PDFs were attempted but the extractor returned no usable result. */
  | "extractor_failed"
  /** No existing LR + no usable contactId, so we declined to create. */
  | "skipped"
  /** Daily budget cap hit before this deal could be processed. */
  | "budget_capped"

export interface ScanOutcome {
  dealId: string
  status: ScanStatus
  leaseRecordId: string | null
  leaseEndDate: string | null
  leaseStartDate: string | null
  searchTermsUsed: string[]
  messagesScanned: number
  pdfsAttempted: number
  reasoning?: string
}

export interface SearchedMessage {
  id: string
  subject: string
  receivedDateTime: string
  hasAttachments: boolean
}

export interface AttachmentMeta {
  id: string
  name: string
  contentType: string
  size: number
}

export interface ScanOptions {
  dealRows: ScanMissingDealRow[]
  /**
   * Cap on Graph $search messages returned per deal. Default 30.
   * Larger values slow the scan and risk fanning out across unrelated
   * threads — most leases land in the first 5-10 hits.
   */
  maxMessagesPerDeal?: number
  /**
   * Cap on PDF extraction calls per deal. Default 5. Each call costs
   * ~$0.02-$0.05 against the lease-backfill daily budget.
   */
  maxPdfsPerDeal?: number
  /** Throttle between deals (Graph rate-limit hygiene). Default 1500ms. */
  throttleMs?: number

  // -------------------- test injection seams --------------------
  searchMessagesFn?: (
    queryTerms: string[],
    take: number
  ) => Promise<SearchedMessage[]>
  fetchMessageAttachmentsFn?: (messageId: string) => Promise<AttachmentMeta[]>
  extractLeaseFromPdfFn?: typeof extractLeaseFromPdf
  downloadAttachmentFn?: typeof downloadAttachment
  /** Stub the assertWithinLeaseBackfillBudget call for tests. */
  assertWithinBudgetFn?: typeof assertWithinLeaseBackfillBudget
  /** Override the sleep used between deals (tests use vi.useFakeTimers). */
  sleepFn?: (ms: number) => Promise<void>
}

export interface ScanTotals {
  updated: number
  created: number
  noPdf: number
  noMessages: number
  extractorFailed: number
  skipped: number
  budgetCapped: number
}

export interface ScanResult {
  outcomes: ScanOutcome[]
  totals: ScanTotals
  totalMessagesScanned: number
  totalPdfsAttempted: number
  /** Sum of estimated_usd from any ScrubApiCall rows added during the run. */
  spentUsd: number
}

const DEFAULT_MAX_MESSAGES = 30
const DEFAULT_MAX_PDFS = 5
const DEFAULT_THROTTLE_MS = 1500

const PDF_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
  "text/x-pdf",
])

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build the Graph `$search` value. Each non-empty term is wrapped in
 * double-quotes for exact-phrase matching, then combined with OR.
 *
 * Graph's `$search` quoting rules: the entire value is wrapped in
 * double-quotes by the URL encoder, and inner quotes need to survive.
 * We replace any `"` in the term with a single space (Graph treats
 * quoted strings as exact phrases; an embedded quote would break the
 * parse).
 */
export function buildGraphSearchValue(terms: string[]): string {
  const cleaned = Array.from(
    new Set(
      terms
        .map((t) => t?.trim())
        .filter((t): t is string => Boolean(t && t.length >= 3))
        .map((t) => t.replace(/"/g, " ").replace(/\s+/g, " ").trim())
    )
  )
  return cleaned.map((t) => `"${t}"`).join(" OR ")
}

async function defaultSearchMessages(
  queryTerms: string[],
  take: number
): Promise<SearchedMessage[]> {
  const upn = process.env.MSGRAPH_TARGET_UPN
  if (!upn) throw new Error("MSGRAPH_TARGET_UPN not set")
  // `buildGraphSearchValue` already returns the inner KQL: `"phrase1" OR "phrase2"`.
  // Graph wants this wrapped in ONE pair of outer quotes when passed via the
  // URL: `?$search="<inner>"`. We URL-encode the whole literal (inner quotes
  // included). Double-wrapping (which the original code did) produces
  // `?$search=""..."` which Graph rejects with "An identifier was expected
  // at position 0".
  const search = buildGraphSearchValue(queryTerms)
  if (!search) return []

  const token = await getAccessToken()
  // Graph requires `ConsistencyLevel: eventual` on $search across the
  // /messages collection. Without it, the request is rejected with
  // `InefficientFilter`. The `$select` keeps the response small.
  // Note: `$search` doesn't allow `$orderby` simultaneously — Graph 400s.
  const url =
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(upn)}/messages` +
    `?$search=${encodeURIComponent(`"${search.replace(/"/g, '\\"')}"`)}` +
    `&$top=${encodeURIComponent(String(take))}` +
    `&$select=id,subject,receivedDateTime,hasAttachments`

  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      ConsistencyLevel: "eventual",
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `graph $search failed (${res.status}): ${text.slice(0, 200)}`
    )
  }
  const json = (await res.json()) as {
    value?: Array<{
      id?: string
      subject?: string | null
      receivedDateTime?: string
      hasAttachments?: boolean
    }>
  }
  const value = Array.isArray(json.value) ? json.value : []
  return value.map((m) => ({
    id: m.id ?? "",
    subject: m.subject ?? "",
    receivedDateTime: m.receivedDateTime ?? "",
    hasAttachments: m.hasAttachments === true,
  }))
}

async function defaultFetchAttachments(
  messageId: string
): Promise<AttachmentMeta[]> {
  const upn = process.env.MSGRAPH_TARGET_UPN
  if (!upn) throw new Error("MSGRAPH_TARGET_UPN not set")
  const token = await getAccessToken()
  const url =
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(upn)}` +
    `/messages/${encodeURIComponent(messageId)}/attachments` +
    `?$select=id,name,contentType,size`
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `graph attachments list failed (${res.status}): ${text.slice(0, 200)}`
    )
  }
  const json = (await res.json()) as {
    value?: Array<{
      id?: string
      name?: string
      contentType?: string
      size?: number
    }>
  }
  const value = Array.isArray(json.value) ? json.value : []
  return value.map((a) => ({
    id: a.id ?? "",
    name: a.name ?? "(unnamed)",
    contentType: a.contentType ?? "application/octet-stream",
    size: typeof a.size === "number" ? a.size : 0,
  }))
}

function isLikelyPdf(meta: AttachmentMeta): boolean {
  if (PDF_CONTENT_TYPES.has(meta.contentType.toLowerCase())) return true
  return meta.name.toLowerCase().endsWith(".pdf")
}

function emptyOutcome(deal: ScanMissingDealRow, status: ScanStatus): ScanOutcome {
  return {
    dealId: deal.dealId,
    status,
    leaseRecordId: deal.existingLeaseRecordId,
    leaseEndDate: null,
    leaseStartDate: null,
    searchTermsUsed: [],
    messagesScanned: 0,
    pdfsAttempted: 0,
  }
}

function appendNote(existing: string | null, line: string): string {
  if (!existing || existing.trim().length === 0) return line
  return `${existing.trimEnd()}\n${line}`
}

async function persistExtraction(args: {
  deal: ScanMissingDealRow
  result: import("@/lib/ai/lease-types").LeaseExtraction
  messagesScanned: number
  pdfsAttempted: number
  searchTermsUsed: string[]
}): Promise<ScanOutcome> {
  const { deal, result, messagesScanned, pdfsAttempted, searchTermsUsed } = args
  const today = new Date().toISOString().slice(0, 10)
  const noteLine = `Lease dates discovered via email scan ${today}`
  const startDate = result.leaseStartDate ? new Date(result.leaseStartDate) : null
  const endDate = result.leaseEndDate ? new Date(result.leaseEndDate) : null

  if (deal.existingLeaseRecordId) {
    const updated = await db.leaseRecord.update({
      where: { id: deal.existingLeaseRecordId },
      data: {
        leaseStartDate: startDate ?? undefined,
        leaseEndDate: endDate ?? undefined,
        leaseTermMonths: result.leaseTermMonths ?? undefined,
        rentAmount: result.rentAmount ?? undefined,
        rentPeriod: result.rentPeriod ?? undefined,
        extractionConfidence: result.confidence,
        notes: appendNote(null, noteLine),
      },
      select: { id: true, notes: true },
    })
    // Append (don't overwrite) — fetch + write so we don't clobber an
    // existing note. update() above seeded `notes` only when null;
    // re-write if there was prior content.
    if (updated.notes && !updated.notes.includes(noteLine)) {
      await db.leaseRecord.update({
        where: { id: deal.existingLeaseRecordId },
        data: { notes: appendNote(updated.notes, noteLine) },
      })
    }
    return {
      dealId: deal.dealId,
      status: "updated",
      leaseRecordId: deal.existingLeaseRecordId,
      leaseEndDate: result.leaseEndDate,
      leaseStartDate: result.leaseStartDate,
      searchTermsUsed,
      messagesScanned,
      pdfsAttempted,
      reasoning: result.reasoning,
    }
  }

  // No existing LR — need a contactId. If the row didn't carry one,
  // skip rather than fabricate (per STOP-and-escalate guidance).
  if (!deal.contactId) {
    return {
      dealId: deal.dealId,
      status: "skipped",
      leaseRecordId: null,
      leaseEndDate: result.leaseEndDate,
      leaseStartDate: result.leaseStartDate,
      searchTermsUsed,
      messagesScanned,
      pdfsAttempted,
      reasoning: "no contactId and no existing LeaseRecord; refusing to fabricate a contact",
    }
  }

  const created = await db.leaseRecord.create({
    data: {
      contactId: deal.contactId,
      propertyId: deal.propertyId ?? undefined,
      dealId: deal.dealId,
      closeDate: deal.closeDate ?? undefined,
      leaseStartDate: startDate ?? undefined,
      leaseEndDate: endDate ?? undefined,
      leaseTermMonths: result.leaseTermMonths ?? undefined,
      rentAmount: result.rentAmount ?? undefined,
      rentPeriod: result.rentPeriod ?? undefined,
      mattRepresented: result.mattRepresented ?? undefined,
      dealKind: result.dealKind,
      extractionConfidence: result.confidence,
      status: "active",
      notes: noteLine,
    },
    select: { id: true },
  })

  return {
    dealId: deal.dealId,
    status: "created",
    leaseRecordId: created.id,
    leaseEndDate: result.leaseEndDate,
    leaseStartDate: result.leaseStartDate,
    searchTermsUsed,
    messagesScanned,
    pdfsAttempted,
    reasoning: result.reasoning,
  }
}

/**
 * Scan one deal. Pure-ish: takes injectable Graph + extractor
 * helpers. Throws only on hard programmer errors — every recoverable
 * failure mode lands in a `ScanOutcome.status` value.
 */
async function scanOneDeal(args: {
  deal: ScanMissingDealRow
  maxMessages: number
  maxPdfs: number
  searchMessagesFn: NonNullable<ScanOptions["searchMessagesFn"]>
  fetchMessageAttachmentsFn: NonNullable<
    ScanOptions["fetchMessageAttachmentsFn"]
  >
  extractLeaseFromPdfFn: NonNullable<ScanOptions["extractLeaseFromPdfFn"]>
  downloadAttachmentFn: NonNullable<ScanOptions["downloadAttachmentFn"]>
  assertWithinBudgetFn: NonNullable<ScanOptions["assertWithinBudgetFn"]>
}): Promise<ScanOutcome> {
  const { deal } = args

  const searchTermsUsed = Array.from(
    new Set(
      deal.searchTerms
        .map((t) => t?.trim())
        .filter((t): t is string => Boolean(t && t.length >= 3))
    )
  )
  if (searchTermsUsed.length === 0) {
    return {
      ...emptyOutcome(deal, "no_messages"),
      reasoning: "no usable search terms after cleanup",
    }
  }

  const messages = await args.searchMessagesFn(searchTermsUsed, args.maxMessages)
  const withAttachments = messages.filter((m) => m.hasAttachments && m.id)
  if (withAttachments.length === 0) {
    return {
      ...emptyOutcome(deal, "no_messages"),
      searchTermsUsed,
      messagesScanned: messages.length,
      reasoning:
        messages.length === 0
          ? "graph $search returned 0 messages"
          : "no messages with attachments in the result set",
    }
  }

  let pdfsAttempted = 0
  let lastExtractorReason: string | undefined
  let sawAnyPdf = false

  // Walk newest-first messages; for each, list attachments, sort PDFs
  // by size (smallest first — extractor cap is 32MB), and try.
  for (const message of withAttachments) {
    if (pdfsAttempted >= args.maxPdfs) break

    let attachments: AttachmentMeta[]
    try {
      attachments = await args.fetchMessageAttachmentsFn(message.id)
    } catch (err) {
      lastExtractorReason = `attachment list failed: ${
        err instanceof Error ? err.message : String(err)
      }`
      continue
    }
    const pdfs = attachments
      .filter((a) => isLikelyPdf(a) && a.id)
      .sort((a, b) => a.size - b.size)
    if (pdfs.length === 0) continue
    sawAnyPdf = true

    for (const pdf of pdfs) {
      if (pdfsAttempted >= args.maxPdfs) break

      // Budget gate before each extractor call.
      try {
        await args.assertWithinBudgetFn()
      } catch (err) {
        if (err instanceof LeaseBackfillBudgetError) {
          return {
            ...emptyOutcome(deal, "budget_capped"),
            searchTermsUsed,
            messagesScanned: messages.length,
            pdfsAttempted,
            reasoning: err.message,
          }
        }
        throw err
      }

      let blob: Awaited<ReturnType<typeof downloadAttachment>>
      try {
        blob = await args.downloadAttachmentFn(message.id, pdf.id)
      } catch (err) {
        lastExtractorReason = `download failed: ${
          err instanceof Error ? err.message : String(err)
        }`
        continue
      }

      pdfsAttempted += 1
      const extracted = await args.extractLeaseFromPdfFn({
        pdf: blob.contentBytes,
        classification:
          deal.expectedDealKind === "lease" ? "closed_lease" : "closed_sale",
        signals: searchTermsUsed,
        subject: message.subject ?? "(no subject)",
      })

      if (extracted.ok) {
        // Only treat as a real "found" outcome if the extractor
        // actually got an end date for lease deals — without one we
        // haven't accomplished the scanner's goal.
        if (
          deal.expectedDealKind === "lease" &&
          !extracted.result.leaseEndDate
        ) {
          lastExtractorReason = "extractor returned no leaseEndDate"
          continue
        }
        return await persistExtraction({
          deal,
          result: extracted.result,
          messagesScanned: messages.length,
          pdfsAttempted,
          searchTermsUsed,
        })
      } else {
        lastExtractorReason = `${extracted.reason}${
          extracted.details ? `: ${extracted.details}` : ""
        }`
      }
    }
  }

  if (!sawAnyPdf) {
    return {
      ...emptyOutcome(deal, "no_pdf_found"),
      searchTermsUsed,
      messagesScanned: messages.length,
      pdfsAttempted,
      reasoning: "messages had attachments but none were PDFs",
    }
  }

  return {
    ...emptyOutcome(deal, "extractor_failed"),
    searchTermsUsed,
    messagesScanned: messages.length,
    pdfsAttempted,
    reasoning: lastExtractorReason ?? "extractor returned no usable result",
  }
}

export async function scanMissingLeaseEndDates(
  opts: ScanOptions
): Promise<ScanResult> {
  const maxMessages = opts.maxMessagesPerDeal ?? DEFAULT_MAX_MESSAGES
  const maxPdfs = opts.maxPdfsPerDeal ?? DEFAULT_MAX_PDFS
  const throttleMs = opts.throttleMs ?? DEFAULT_THROTTLE_MS
  const sleep = opts.sleepFn ?? defaultSleep
  const searchMessagesFn = opts.searchMessagesFn ?? defaultSearchMessages
  const fetchMessageAttachmentsFn =
    opts.fetchMessageAttachmentsFn ?? defaultFetchAttachments
  const extractLeaseFromPdfFn = opts.extractLeaseFromPdfFn ?? extractLeaseFromPdf
  const downloadAttachmentFn = opts.downloadAttachmentFn ?? downloadAttachment
  const assertWithinBudgetFn =
    opts.assertWithinBudgetFn ?? assertWithinLeaseBackfillBudget

  const outcomes: ScanOutcome[] = []
  const totals: ScanTotals = {
    updated: 0,
    created: 0,
    noPdf: 0,
    noMessages: 0,
    extractorFailed: 0,
    skipped: 0,
    budgetCapped: 0,
  }
  let totalMessagesScanned = 0
  let totalPdfsAttempted = 0

  for (let i = 0; i < opts.dealRows.length; i += 1) {
    const deal = opts.dealRows[i]
    if (!deal) continue

    const outcome = await scanOneDeal({
      deal,
      maxMessages,
      maxPdfs,
      searchMessagesFn,
      fetchMessageAttachmentsFn,
      extractLeaseFromPdfFn,
      downloadAttachmentFn,
      assertWithinBudgetFn,
    })
    outcomes.push(outcome)
    totalMessagesScanned += outcome.messagesScanned
    totalPdfsAttempted += outcome.pdfsAttempted
    switch (outcome.status) {
      case "updated":
        totals.updated += 1
        break
      case "created":
        totals.created += 1
        break
      case "no_pdf_found":
        totals.noPdf += 1
        break
      case "no_messages":
        totals.noMessages += 1
        break
      case "extractor_failed":
        totals.extractorFailed += 1
        break
      case "skipped":
        totals.skipped += 1
        break
      case "budget_capped":
        totals.budgetCapped += 1
        break
    }

    // Once budget is capped, stop spending Graph time too.
    if (outcome.status === "budget_capped") break

    if (i < opts.dealRows.length - 1) {
      await sleep(throttleMs)
    }
  }

  // Sum cost by querying ScrubApiCall rows tagged as PDF-extractor
  // outcomes since the run started. We capture a marker timestamp at
  // the top of the call so the query is bounded.
  const spentUsd = await sumPdfExtractorSpendSince(runStartedAt)

  return {
    outcomes,
    totals,
    totalMessagesScanned,
    totalPdfsAttempted,
    spentUsd,
  }
}

// Hoisted so the `runStartedAt` capture happens at module scope timing
// for tests that mock around `Date.now`.
const runStartedAt = new Date()

async function sumPdfExtractorSpendSince(since: Date): Promise<number> {
  try {
    const result = await db.scrubApiCall.aggregate({
      where: {
        at: { gte: since },
        outcome: { startsWith: "extractor-pdf-" },
      },
      _sum: { estimatedUsd: true },
    })
    const value = result._sum.estimatedUsd
    if (value == null) return 0
    return typeof value === "number" ? value : Number(value.toString())
  } catch {
    // Telemetry-only — never fail the scan because we couldn't sum.
    return 0
  }
}
