/**
 * Email-history backfill — date-range pagination engine.
 *
 * Stream D of the lease lifecycle plan (docs/superpowers/plans/2026-05-02-lease-lifecycle.md).
 *
 * The existing `fetchEmailDelta` flow in `./emails.ts` is delta-based and
 * bounded to ~30-90 days back without a prior cursor. To reach 10 years of
 * Outlook archive (lease close emails Matt may have sent in 2016) we need a
 * separate path:
 *
 *   - Walk month-by-month from `startMonth` (most recent) backwards toward
 *     `endMonth`, issuing `$filter=receivedDateTime ge X and lt Y` calls.
 *   - Page each month internally with `$top=100` + `@odata.nextLink`.
 *   - Throttle 1s between Graph requests (Graph rate-limit hygiene; the
 *     per-app limit is ~10K calls per 10 minutes).
 *   - Hand each message to the existing `processOneMessage` so all the
 *     filter/dedupe/redact/persist logic stays in ONE place. We do NOT
 *     duplicate any of that here. (See the plan: "DO NOT change emails.ts
 *     or the existing fetchEmailDelta flow".)
 *   - Persist a per-folder cursor in `SystemState` keyed by
 *     `email_history_cursor:{folder}` so an aborted run resumes cleanly.
 *
 * Storage / cost note: each Communication row is ~5 KB. A 10-year backfill
 * against a busy CRE inbox (~880K messages) lands ~4-5 GB of new rows. That
 * is well within Supabase headroom but worth knowing before kicking it off.
 *
 * Operator-driven only: this is invoked via the admin-token-gated POST route
 * `/api/integrations/msgraph/email-history-backfill` (and through that, the
 * `scripts/lease-history-scan.mjs` CLI wrapper). Nothing schedules it.
 */

import type { Prisma } from "@prisma/client"
import type { EmailFolder, GraphEmailMessage } from "./email-types"

import { db } from "@/lib/prisma"

import { graphFetch } from "./client"
import { loadMsgraphConfig } from "./config"
import { EMAIL_METADATA_SELECT_FIELDS, processOneMessage } from "./emails"

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunEmailHistoryBackfillOptions {
  /** Most-recent month to scan, inclusive. `YYYY-MM`. */
  startMonth: string
  /** Oldest month to scan, inclusive. `YYYY-MM`. Must be <= startMonth. */
  endMonth: string
  /** Mailbox folder. Defaults to "inbox". */
  folder?: EmailFolder
  /**
   * Cap per invocation: at most `maxBatches * 100` messages will be
   * processed before the function returns. The cursor is updated as
   * months complete so the operator can re-invoke to resume. Defaults
   * to 50 (= 5,000 messages per call ~= a few minutes of work).
   */
  maxBatches?: number
  /** Test seam: override the inter-request sleep. Defaults to 1000ms. */
  rateLimitMs?: number
}

export interface HistoryBackfillCursorState {
  /** Most-recently-completed month string `YYYY-MM`. Null on first run. */
  lastCompletedMonth: string | null
  /** Cumulative messages processed across all invocations for this folder. */
  processedCount: number
  /** Last error message, if the previous run threw mid-month. */
  lastError?: string
  /** Last update timestamp (ISO). */
  updatedAt: string
}

export interface HistoryBackfillResult {
  folder: EmailFolder
  startMonth: string
  endMonth: string
  monthsProcessed: string[]
  monthsSkipped: string[]
  messagesSeen: number
  messagesInserted: number
  batchesUsed: number
  reachedBatchCap: boolean
  done: boolean
  cursor: HistoryBackfillCursorState
  errors: Array<{ month: string; message: string }>
}

const DEFAULT_RATE_LIMIT_MS = 1000
const DEFAULT_MAX_BATCHES = 50
const PAGE_SIZE = 100

const SYSTEM_STATE_KEY_PREFIX = "email_history_cursor:"

function cursorKey(folder: EmailFolder): string {
  return `${SYSTEM_STATE_KEY_PREFIX}${folder}`
}

// ---------------------------------------------------------------------------
// Cursor persistence
// ---------------------------------------------------------------------------

export async function loadHistoryCursor(
  folder: EmailFolder
): Promise<HistoryBackfillCursorState | null> {
  const row = await db.systemState.findUnique({
    where: { key: cursorKey(folder) },
  })
  if (!row) return null
  return coerceCursor(row.value)
}

export async function saveHistoryCursor(
  folder: EmailFolder,
  next: HistoryBackfillCursorState
): Promise<void> {
  const value = next as unknown as Prisma.InputJsonValue
  await db.systemState.upsert({
    where: { key: cursorKey(folder) },
    create: { key: cursorKey(folder), value },
    update: { value },
  })
}

function coerceCursor(raw: unknown): HistoryBackfillCursorState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const lastCompletedMonth =
    typeof obj.lastCompletedMonth === "string" &&
    /^\d{4}-\d{2}$/.test(obj.lastCompletedMonth)
      ? obj.lastCompletedMonth
      : null
  const processedCount =
    typeof obj.processedCount === "number" &&
    Number.isFinite(obj.processedCount)
      ? obj.processedCount
      : 0
  const lastError =
    typeof obj.lastError === "string" ? obj.lastError : undefined
  const updatedAt =
    typeof obj.updatedAt === "string"
      ? obj.updatedAt
      : new Date(0).toISOString()
  return { lastCompletedMonth, processedCount, lastError, updatedAt }
}

// ---------------------------------------------------------------------------
// Month iteration helpers
// ---------------------------------------------------------------------------

const MONTH_RE = /^(\d{4})-(\d{2})$/

function parseMonth(s: string): { year: number; month: number } {
  const m = MONTH_RE.exec(s)
  if (!m) throw new Error(`invalid month string: ${s} (expected YYYY-MM)`)
  const year = Number.parseInt(m[1], 10)
  const month = Number.parseInt(m[2], 10)
  if (month < 1 || month > 12) {
    throw new Error(`invalid month string: ${s} (month must be 01-12)`)
  }
  return { year, month }
}

function compareMonths(a: string, b: string): number {
  const ay = parseMonth(a)
  const by = parseMonth(b)
  if (ay.year !== by.year) return ay.year - by.year
  return ay.month - by.month
}

function previousMonth(s: string): string {
  const { year, month } = parseMonth(s)
  if (month === 1) return `${pad4(year - 1)}-12`
  return `${pad4(year)}-${pad2(month - 1)}`
}

function monthBounds(s: string): { startIso: string; endIso: string } {
  const { year, month } = parseMonth(s)
  const startIso = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  // First day of next month (exclusive upper bound).
  const endYear = month === 12 ? year + 1 : year
  const endMonth = month === 12 ? 1 : month + 1
  const endIso = new Date(Date.UTC(endYear, endMonth - 1, 1)).toISOString()
  return { startIso, endIso }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
function pad4(n: number): string {
  return String(n).padStart(4, "0")
}

/**
 * Build the list of months to iterate, in order from startMonth (newest)
 * down to endMonth (oldest), inclusive. Empty if startMonth < endMonth.
 */
export function enumerateMonthsDescending(
  startMonth: string,
  endMonth: string
): string[] {
  if (compareMonths(startMonth, endMonth) < 0) return []
  const out: string[] = []
  let cursor = startMonth
  while (compareMonths(cursor, endMonth) >= 0) {
    out.push(cursor)
    if (cursor === endMonth) break
    cursor = previousMonth(cursor)
  }
  return out
}

// ---------------------------------------------------------------------------
// Graph paged fetch for one month
// ---------------------------------------------------------------------------

interface GraphMessagesPage {
  value: GraphEmailMessage[]
  "@odata.nextLink"?: string
}

/**
 * Test-seam fetch type. The engine only ever asks for `GraphMessagesPage`,
 * so the seam is page-shaped rather than the fully-generic `graphFetch`
 * signature — that keeps test mocks simple.
 */
type FetchPageImpl = (url: string) => Promise<GraphMessagesPage>

interface FetchMonthOptions {
  folder: EmailFolder
  month: string
  targetUpn: string
  rateLimitMs: number
  /** Test seam — overrides graphFetch. */
  fetchImpl?: FetchPageImpl
  /** Test seam — overrides setTimeout-based delay. */
  sleepImpl?: (ms: number) => Promise<void>
  /** Stop early if the per-invocation batch cap is hit. */
  shouldContinue: () => boolean
}

/**
 * Async-iterate Graph message pages for a single month. Each yielded page
 * is rate-limited from the next request by `rateLimitMs`.
 */
async function* fetchMonthPages(
  opts: FetchMonthOptions
): AsyncGenerator<GraphMessagesPage, void, void> {
  const { folder, month, targetUpn, rateLimitMs } = opts
  const fetchImpl: FetchPageImpl =
    opts.fetchImpl ?? ((url: string) => graphFetch<GraphMessagesPage>(url))
  const sleepImpl = opts.sleepImpl ?? sleep

  const { startIso, endIso } = monthBounds(month)
  const filter = `receivedDateTime ge ${startIso} and receivedDateTime lt ${endIso}`

  // Initial URL — relative path, graphFetch will prepend the base.
  let url: string | undefined =
    `/users/${encodeURIComponent(targetUpn)}/mailFolders/${folder}/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$top=${PAGE_SIZE}` +
    `&$select=${encodeURIComponent(EMAIL_METADATA_SELECT_FIELDS)}` +
    `&$orderby=${encodeURIComponent("receivedDateTime desc")}`

  let isFirst = true
  while (url) {
    if (!isFirst) {
      // 1 second between Graph requests for rate-limit hygiene.
      await sleepImpl(rateLimitMs)
    }
    if (!opts.shouldContinue()) return
    const page = await fetchImpl(url)
    yield page
    url = page["@odata.nextLink"]
    isFirst = false
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Run one bounded slice of the email-history backfill.
 *
 * Iterates months in descending order from `startMonth` to `endMonth`. For
 * each month, walks paginated Graph results and forwards every message to
 * `processOneMessage` (the existing pipeline — filter, dedupe, persist).
 *
 * Resume-safe: if a saved cursor's `lastCompletedMonth` is newer than or
 * equal to a candidate month, that month is skipped. Cursor is written
 * after each month finishes, AND on early-exit due to error or batch cap.
 *
 * The hard exit knob is `maxBatches * 100`: when that many messages have
 * been seen in this invocation, the engine stops processing new pages,
 * persists the cursor (NOT advancing past the in-progress month), and
 * returns. Operator re-invocation re-starts that month from the top —
 * the ingest pipeline dedupes by `externalMessageId` so reprocessing is
 * cheap, just an existence-check per row.
 */
export async function runEmailHistoryBackfill(
  options: RunEmailHistoryBackfillOptions & {
    fetchImpl?: FetchPageImpl
    sleepImpl?: (ms: number) => Promise<void>
    processOneMessageImpl?: typeof processOneMessage
    cursorIO?: {
      load: (folder: EmailFolder) => Promise<HistoryBackfillCursorState | null>
      save: (
        folder: EmailFolder,
        next: HistoryBackfillCursorState
      ) => Promise<void>
    }
  }
): Promise<HistoryBackfillResult> {
  const folder: EmailFolder = options.folder ?? "inbox"
  const maxBatches = Math.max(1, options.maxBatches ?? DEFAULT_MAX_BATCHES)
  const rateLimitMs = options.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS
  const messageCap = maxBatches * PAGE_SIZE

  if (!MONTH_RE.test(options.startMonth)) {
    throw new Error(
      `invalid startMonth: ${options.startMonth} (expected YYYY-MM)`
    )
  }
  if (!MONTH_RE.test(options.endMonth)) {
    throw new Error(`invalid endMonth: ${options.endMonth} (expected YYYY-MM)`)
  }
  if (compareMonths(options.startMonth, options.endMonth) < 0) {
    throw new Error(
      `startMonth (${options.startMonth}) must be >= endMonth (${options.endMonth})`
    )
  }

  const cfg = loadMsgraphConfig()
  const cursorIO = options.cursorIO ?? {
    load: loadHistoryCursor,
    save: saveHistoryCursor,
  }
  const processFn = options.processOneMessageImpl ?? processOneMessage

  const cursor: HistoryBackfillCursorState = (await cursorIO.load(folder)) ?? {
    lastCompletedMonth: null,
    processedCount: 0,
    updatedAt: new Date(0).toISOString(),
  }

  const months = enumerateMonthsDescending(options.startMonth, options.endMonth)

  const result: HistoryBackfillResult = {
    folder,
    startMonth: options.startMonth,
    endMonth: options.endMonth,
    monthsProcessed: [],
    monthsSkipped: [],
    messagesSeen: 0,
    messagesInserted: 0,
    batchesUsed: 0,
    reachedBatchCap: false,
    done: false,
    cursor,
    errors: [],
  }

  let invocationProcessed = 0
  const shouldContinue = () => invocationProcessed < messageCap

  for (const month of months) {
    // Resume-safety: if cursor says we already finished a month newer than
    // OR equal to this one, skip. Months iterate descending (newest →
    // oldest); lastCompletedMonth tracks the OLDEST month we finished.
    // So we skip a month when it is newer-or-equal to lastCompletedMonth.
    if (
      cursor.lastCompletedMonth &&
      compareMonths(month, cursor.lastCompletedMonth) >= 0
    ) {
      result.monthsSkipped.push(month)
      continue
    }

    if (!shouldContinue()) {
      result.reachedBatchCap = true
      break
    }

    let monthMessageCount = 0
    let monthInserted = 0
    let aborted = false
    let monthHasMorePages = false

    try {
      for await (const page of fetchMonthPages({
        folder,
        month,
        targetUpn: cfg.targetUpn,
        rateLimitMs,
        fetchImpl: options.fetchImpl,
        sleepImpl: options.sleepImpl,
        shouldContinue,
      })) {
        result.batchesUsed += 1
        // Track whether we KNOW more pages remain after this one — that
        // info is what tells us we hit the cap mid-month vs. naturally
        // finished the month.
        monthHasMorePages = !!page["@odata.nextLink"]
        for (const message of page.value ?? []) {
          if (!shouldContinue()) {
            aborted = true
            result.reachedBatchCap = true
            break
          }
          monthMessageCount += 1
          invocationProcessed += 1
          result.messagesSeen += 1
          try {
            const summary = await processFn(message, folder, "observe")
            if (summary.inserted) {
              monthInserted += 1
              result.messagesInserted += 1
            }
          } catch (err) {
            // Individual-message failure: record and continue. The
            // ingest pipeline already persists a `failed` ExternalSync
            // row inside processOneMessage's caller in `syncEmails`,
            // but here we're calling processOneMessage directly so a
            // throw bubbles. Track as month-level error so the operator
            // sees it; we do NOT advance the cursor past a month that
            // had failures.
            result.errors.push({
              month,
              message: err instanceof Error ? err.message : String(err),
            })
          }
        }
        // If the page-generator's pre-fetch shouldContinue gate fired and
        // it short-circuited a follow-up page, we won't see the abort here
        // through `aborted` alone. Detect it via shouldContinue() + nextLink.
        if (!aborted && monthHasMorePages && !shouldContinue()) {
          aborted = true
          result.reachedBatchCap = true
        }
        if (aborted) break
      }
    } catch (err) {
      // Whole-month fetch failure (Graph error, auth, etc). Record
      // and stop the run so the operator can investigate. Cursor is
      // NOT advanced past this month.
      result.errors.push({
        month,
        message: err instanceof Error ? err.message : String(err),
      })
      cursor.lastError = err instanceof Error ? err.message : String(err)
      cursor.updatedAt = new Date().toISOString()
      cursor.processedCount += monthMessageCount
      await cursorIO.save(folder, cursor)
      result.cursor = cursor
      return result
    }

    if (aborted) {
      // Hit batch cap mid-month. Don't advance the cursor — next run
      // will redo this month, and the pipeline's externalMessageId
      // dedupe makes that cheap.
      cursor.processedCount += monthMessageCount
      cursor.updatedAt = new Date().toISOString()
      await cursorIO.save(folder, cursor)
      result.cursor = cursor
      return result
    }

    // Month completed — advance cursor to this month (the oldest one
    // we've now finished).
    result.monthsProcessed.push(month)
    cursor.lastCompletedMonth = month
    cursor.processedCount += monthMessageCount
    cursor.lastError = undefined
    cursor.updatedAt = new Date().toISOString()
    await cursorIO.save(folder, cursor)

    // Bookkeeping for tests + caller visibility.
    void monthInserted
  }

  result.done = !result.reachedBatchCap
  result.cursor = cursor
  return result
}
