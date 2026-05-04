import { db } from "@/lib/prisma"

import {
  BackfillAlreadyRunningError,
  backfillMailboxForContact,
} from "./index"
import type { BackfillMode } from "./window-resolver"

export interface BulkInput {
  /**
   * Explicit contact ids to process. If omitted/empty, defaults to every
   * client-typed contact with an email address and zero existing
   * Communications (the "never-touched" cohort the bulk run is designed for).
   */
  contactIds?: string[]
  mode?: BackfillMode
  trigger?: "bulk" | "cli"
  /** Delay between contacts in ms. Default 500. Pass 0 in tests. */
  delayBetweenMs?: number
  /** Forward dryRun to per-contact runs (Graph fetch, no ingest). */
  dryRun?: boolean
  /**
   * Per-contact timeout in ms. Default 10 minutes. Tests pass smaller values
   * (e.g. 50ms) so the timeout path is exercisable without real-time delays.
   * On timeout we count the contact as failed with `error: "per_contact_timeout"`
   * and continue to the next id; the underlying work is NOT aborted (Node will
   * keep it running in the background) but the loop moves on.
   */
  perContactTimeoutMs?: number
  /**
   * Optional progress callback invoked after each contact completes.
   * `done` is 1-based count of contacts attempted, `total` is the cohort size.
   * `status` is the per-contact outcome ("succeeded" | "skipped" | "failed").
   * Passing this lets the CLI render `[N/M] processing <id>` style progress
   * lines without spawning N parent BackfillRun rows (one parent per bulk
   * sweep is the design goal).
   */
  onProgress?: (
    done: number,
    total: number,
    contactId: string,
    status: "succeeded" | "skipped" | "failed"
  ) => void
}

export interface BulkResult {
  parentRunId: string
  totalContacts: number
  succeeded: number
  failed: number
  skipped: number
  totalMessagesIngested: number
  totalScrubQueued: number
  failures: Array<{ contactId: string; error: string }>
  skips: Array<{ contactId: string; reason: string }>
}

/**
 * Client cohorts targeted by the bulk backfill default selector. Mirrors the
 * client-types currently classified in `src/lib/contacts/role-lifecycle.ts`
 * (active + past, including the legacy `past_client` value still present in
 * production rows).
 */
const CLIENT_TYPES = [
  "active_listing_client",
  "active_buyer_rep_client",
  "past_client",
  "past_listing_client",
  "past_buyer_client",
] as const

/** Default per-contact timeout: 10 minutes. */
const DEFAULT_PER_CONTACT_TIMEOUT_MS = 10 * 60 * 1000

/** Throttle backoff: each 429 detection adds this many ms to delayBetweenMs. */
const THROTTLE_BACKOFF_BUMP_MS = 30_000

/**
 * After this many consecutive successes we drop the throttle bump back to 0
 * (poor-man's AIMD: additive increase, multiplicative... well, snap-back).
 */
const THROTTLE_BACKOFF_RESET_AFTER_SUCCESS = 5

/**
 * Resolve the cohort of contact ids a bulk backfill should target. If the
 * caller passed an explicit list we use it verbatim; otherwise we look up
 * every client-typed contact that has an email address and zero existing
 * Communications.
 *
 * Exported separately so callers (e.g. the bulk HTTP endpoint) can resolve
 * the cohort *before* doing destructive housekeeping like the stuck-run
 * reaper, which needs to be scoped to the cohort to avoid racing with
 * legitimate per-contact UI runs.
 */
export async function resolveBulkContactIds(
  contactIds?: string[]
): Promise<string[]> {
  if (contactIds && contactIds.length > 0) return contactIds
  const candidates = await db.contact.findMany({
    where: {
      clientType: { in: CLIENT_TYPES as unknown as any[] },
      email: { not: null },
      communications: { none: {} },
    },
    select: { id: true },
  })
  return candidates.map((c) => c.id)
}

/**
 * Race a promise against a timeout. On timeout, the rejection wins but the
 * underlying promise keeps running — Node has no general cancellation. The
 * caller should treat the timeout as a soft "skip and move on" signal.
 */
async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  contactId: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`per_contact_timeout: ${contactId}`)),
      ms
    )
  })
  try {
    return await Promise.race([p, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Heuristic check for "Graph said slow down". We don't have a typed throttle
 * error class shared across modules so we sniff the stringified reason for
 * "429" or "throttle". False positives are cheap (we just slow down a bit);
 * false negatives just mean we don't back off, which is the previous behavior.
 */
function looksLikeThrottle(reason: string): boolean {
  const lower = reason.toLowerCase()
  return lower.includes("429") || lower.includes("throttle")
}

/**
 * Derive the parent run's terminal status from per-contact counts. Mirrors
 * what an operator would expect when reading the BackfillRun table: a row
 * marked "succeeded" should mean every child succeeded; "failed" should mean
 * none did; "partial" surfaces the in-between case so it's not silently
 * masked as success.
 */
function deriveParentStatus(
  succeeded: number,
  failed: number
): "succeeded" | "failed" | "partial" {
  if (failed === 0) return "succeeded"
  if (succeeded === 0) return "failed"
  return "partial"
}

export async function runBulkBackfill(input: BulkInput): Promise<BulkResult> {
  const mode: BackfillMode = input.mode ?? "deal-anchored"
  const trigger = input.trigger ?? "bulk"
  const baseDelay = input.delayBetweenMs ?? 500
  const perContactTimeoutMs =
    input.perContactTimeoutMs ?? DEFAULT_PER_CONTACT_TIMEOUT_MS

  // NOTE on SIGINT / Ctrl-C: this function does not register a SIGINT handler.
  // If the operator kills the process mid-loop, the parent BackfillRun stays
  // in `running` until the bulk-endpoint reaper (15min) sweeps it. The CLI
  // wrapper installs a SIGINT handler that finalizes the in-progress parent
  // before exiting; HTTP callers rely on the reaper.
  const parent = await db.backfillRun.create({
    data: { trigger, mode, status: "running" },
  })

  const result: BulkResult = {
    parentRunId: parent.id,
    totalContacts: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalMessagesIngested: 0,
    totalScrubQueued: 0,
    failures: [],
    skips: [],
  }

  // Wrap the entire post-create logic so any thrown error finalizes the
  // parent row instead of leaving it stuck at `running`. The reaper would
  // eventually catch it but operators inspecting the table during the
  // 15-minute window would see a misleading state.
  let finalErrorMessage: string | undefined
  try {
    const contactIds = await resolveBulkContactIds(input.contactIds)
    result.totalContacts = contactIds.length

    let currentDelay = baseDelay
    let consecutiveSuccesses = 0

    for (let i = 0; i < contactIds.length; i++) {
      const cid = contactIds[i]
      let perContactStatus: "succeeded" | "skipped" | "failed" = "failed"
      try {
        const r = await withTimeout(
          backfillMailboxForContact(cid, {
            mode,
            trigger,
            parentRunId: parent.id,
            dryRun: input.dryRun,
          }),
          perContactTimeoutMs,
          cid
        )
        if (r.status === "succeeded") {
          result.succeeded += 1
          result.totalMessagesIngested += r.ingested
          result.totalScrubQueued += r.scrubQueued
          perContactStatus = "succeeded"
          consecutiveSuccesses += 1
          if (
            currentDelay > baseDelay &&
            consecutiveSuccesses >= THROTTLE_BACKOFF_RESET_AFTER_SUCCESS
          ) {
            currentDelay = baseDelay
          }
        } else if (r.status === "skipped") {
          result.skipped += 1
          result.skips.push({ contactId: cid, reason: r.reason ?? "unknown" })
          perContactStatus = "skipped"
          // Skips don't reset throttle — they aren't proof Graph is happy.
        } else {
          result.failed += 1
          const reason = r.reason ?? "unknown"
          result.failures.push({ contactId: cid, error: reason })
          perContactStatus = "failed"
          consecutiveSuccesses = 0
          if (looksLikeThrottle(reason)) {
            currentDelay += THROTTLE_BACKOFF_BUMP_MS
          }
        }
      } catch (err) {
        // BackfillAlreadyRunningError is the partial-unique safety net firing —
        // another orchestrator is already mid-run for this contact. Treat as a
        // soft skip so the bulk run doesn't get marked failed for what is
        // really a "come back later" condition.
        // Match by instanceof OR by name — the partial-unique race is the
        // hot path we want to treat as "skipped, come back later", and a
        // mocked or re-exported class can defeat instanceof in tests.
        const isAlreadyRunning =
          err instanceof BackfillAlreadyRunningError ||
          (err instanceof Error && err.name === "BackfillAlreadyRunningError")
        if (isAlreadyRunning) {
          result.skipped += 1
          result.skips.push({ contactId: cid, reason: "already_running" })
          perContactStatus = "skipped"
        } else {
          const message =
            err instanceof Error ? err.message : String(err ?? "unknown")
          result.failed += 1
          result.failures.push({ contactId: cid, error: message })
          perContactStatus = "failed"
          consecutiveSuccesses = 0
          // Only bump if throttling is active to begin with — `delayBetweenMs: 0`
          // is the explicit "no throttling" mode used by tests and the per-id CLI
          // path; respect that so a test-induced 429 doesn't add 30s of real wait.
          if (baseDelay > 0 && looksLikeThrottle(message)) {
            currentDelay += THROTTLE_BACKOFF_BUMP_MS
          }
        }
      }

      try {
        input.onProgress?.(i + 1, contactIds.length, cid, perContactStatus)
      } catch {
        // A misbehaving progress callback must not poison the whole run.
      }

      if (currentDelay > 0 && i < contactIds.length - 1) {
        await new Promise((r) => setTimeout(r, currentDelay))
      }
    }
  } catch (err) {
    // Anything thrown by the cohort lookup or the loop itself: capture, mark
    // the rest as failed, and let the finally block finalize the parent row.
    finalErrorMessage =
      err instanceof Error ? err.message : String(err ?? "unknown")
  } finally {
    try {
      const status = finalErrorMessage
        ? "failed"
        : deriveParentStatus(result.succeeded, result.failed)
      await db.backfillRun.update({
        where: { id: parent.id },
        data: {
          finishedAt: new Date(),
          status,
          result: result as any,
          ...(finalErrorMessage ? { errorMessage: finalErrorMessage } : {}),
        },
      })
    } catch {
      // If the finalize update itself throws (DB down, etc.) there's not
      // much we can do — the reaper will sweep it. Swallow so the original
      // error (if any) propagates through the implicit re-throw below.
    }
  }

  if (finalErrorMessage) {
    throw new Error(finalErrorMessage)
  }

  return result
}
