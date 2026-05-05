import { Prisma } from "@prisma/client"

import type { BackfillMode, BackfillWindow } from "./window-resolver"

import { enqueueScrubForCommunication } from "@/lib/ai/scrub-queue"
import { PROMPT_VERSION } from "@/lib/ai/scrub-types"
import { loadMsgraphConfig } from "@/lib/msgraph/config"
import { db } from "@/lib/prisma"
import { processInBatches } from "@/lib/util/batch"

import { fetchMessagesForContactWindow } from "./graph-query"
import { ingestSingleBackfillMessage } from "./ingest-message"
import { detectMultiClientConflict } from "./multi-client-conflict"
import { resolveBackfillWindows } from "./window-resolver"

/**
 * Returns true when the stored prompt version differs from the current one
 * (or when no version is recorded). We deliberately use "different" rather
 * than "older" — the format is just `v<N>` and a strict ordering would
 * require version parsing. If the operator ever rolls back PROMPT_VERSION
 * intentionally, re-extraction is still desirable.
 */
export function isPromptVersionStale(
  stored: string | null | undefined,
  current: string
): boolean {
  if (!stored) return true
  return stored !== current
}

/**
 * Thrown when the partial unique index
 * `backfill_runs_one_running_per_contact` rejects a concurrent backfill
 * attempt for the same contact. Route handlers translate this to HTTP 429
 * (the friendlier `findFirst` rate-guard returns 429 too — this error is
 * the safety net for true concurrency that races past that check).
 */
export class BackfillAlreadyRunningError extends Error {
  readonly contactId: string
  constructor(contactId: string) {
    super(`backfill already running for contact ${contactId}`)
    this.name = "BackfillAlreadyRunningError"
    this.contactId = contactId
  }
}

export interface BackfillOptions {
  mode: BackfillMode
  dryRun?: boolean
  trigger?: "ui" | "bulk" | "cli"
  parentRunId?: string
}

export interface BackfillResult {
  runId: string
  contactId: string
  status: "succeeded" | "failed" | "skipped"
  reason?: string
  windowsSearched: BackfillWindow[]
  messagesDiscovered: number
  ingested: number
  deduped: number
  scrubQueued: number
  staleRescrubsEnqueued: number
  /**
   * Stale comms eligible for re-extraction that were NOT enqueued in this
   * call because the per-click cap was hit. Surfaces to the UI so the
   * operator can decide whether to click again to process the next batch.
   * Audit fix (May 2026): a v6→v7 silent rescrub of every comm could fire
   * 200+ DeepSeek calls per click on a long-history contact. The cap
   * bounds runaway cost; the count gives operator visibility.
   */
  staleRescrubsAvailable: number
  multiClientConflicts: number
  durationMs: number
}

/**
 * Maximum stale-prompt re-scrubs to enqueue per "Scan mailbox" click.
 * On a contact with 200+ historical comms, a prompt-version bump would
 * otherwise re-enqueue every signal/uncertain row in one click. With the
 * cap, the UI surfaces the remaining count and the operator clicks again
 * to process the next batch (each click is cheap to bound; total cost is
 * the same but spread across explicit operator decisions).
 */
const STALE_RESCRUB_PER_CLICK_CAP = 25

const POLICY_VERSION = "mailbox-backfill@1"

/**
 * Per-message ingest concurrency. The bottleneck inside processOne is DB
 * writes (Communication insert + occasional OperationalEmailReview) plus a
 * fast classifier. 5 keeps the connection pool happy and roughly 5x's the
 * throughput observed on real backfills (229 messages went from ~6 min to
 * ~75 sec in benchmark). Higher values trade marginal speedup for risk of
 * pool exhaustion under concurrent backfills (bulk runner can stack these).
 */
const INGEST_CONCURRENCY = 5

export async function backfillMailboxForContact(
  contactId: string,
  opts: BackfillOptions
): Promise<BackfillResult> {
  const startedAt = Date.now()
  const trigger = opts.trigger ?? "ui"

  let run: { id: string }
  try {
    run = await db.backfillRun.create({
      data: {
        contactId,
        parentId: opts.parentRunId ?? null,
        trigger,
        mode: opts.mode,
        status: "running",
      },
    })
  } catch (err) {
    // Partial unique `backfill_runs_one_running_per_contact` rejects
    // concurrent runs for the same contact — translate to a typed error
    // so the route can return 429 without finalizing a phantom run.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new BackfillAlreadyRunningError(contactId)
    }
    throw err
  }

  const finalize = async (
    status: "succeeded" | "failed" | "skipped",
    extra: Partial<BackfillResult>,
    errorMessage?: string
  ): Promise<BackfillResult> => {
    const result: BackfillResult = {
      runId: run.id,
      contactId,
      status,
      windowsSearched: [],
      messagesDiscovered: 0,
      ingested: 0,
      deduped: 0,
      scrubQueued: 0,
      staleRescrubsEnqueued: 0,
      staleRescrubsAvailable: 0,
      multiClientConflicts: 0,
      durationMs: Date.now() - startedAt,
      ...extra,
    }
    try {
      await db.backfillRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status,
          result: result as any,
          errorMessage: errorMessage ?? null,
        },
      })
    } catch (err) {
      // P2025 — Record to update not found. The bulk endpoint's stuck-run
      // reaper or an operator cleanup may have deleted the row mid-run
      // (Phase 2 audit I1). The in-memory result is still valid for the
      // caller; we just lose the audit log entry for this run. Don't fail
      // the whole request over a missing audit row.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        console.warn(
          `[backfill] BackfillRun ${run.id} disappeared before finalize — data may have been reaped`
        )
      } else {
        throw err
      }
    }
    return result
  }

  try {
    const contact = await db.contact.findUnique({ where: { id: contactId } })
    if (!contact)
      return await finalize(
        "failed",
        { reason: "contact_not_found" },
        "contact_not_found"
      )
    if (!contact.email)
      return await finalize("skipped", { reason: "no_email_on_file" })

    const [deals, comms] = await Promise.all([
      db.deal.findMany({
        where: { contactId, archivedAt: null },
        select: { id: true, createdAt: true, closedAt: true },
      }),
      db.communication.findMany({
        where: { contactId },
        select: { date: true },
        orderBy: { date: "asc" },
        take: 1,
      }),
    ])

    const windows = resolveBackfillWindows({
      mode: opts.mode,
      deals: deals.map((d) => ({
        createdAt: d.createdAt,
        closedAt: d.closedAt,
      })),
      comms: comms.map((c) => ({ date: c.date })),
      now: new Date(),
    })

    if (windows.length === 0) {
      return await finalize("skipped", { reason: "no_anchor_available" })
    }

    const cfg = loadMsgraphConfig()

    let messagesDiscovered = 0
    let ingested = 0
    let deduped = 0
    let scrubQueued = 0
    let multiClientConflicts = 0
    // Track Communication IDs created/touched in THIS run so the post-ingest
    // stale-rescrub loop doesn't re-enqueue them. Just-ingested rows have no
    // `metadata.scrub.promptVersion` yet (they're awaiting the first scrub),
    // so the staleness predicate would otherwise treat them as stale and
    // double-enqueue every fresh ingest.
    const insertedIds = new Set<string>()

    // Pre-load all client contacts for conflict detection.
    // 286-contact scale per Task 1; safe to load fully.
    // Exclude Matt himself even if he's a Contact row marked as a client —
    // he is the mailbox owner, so he is on every email and would otherwise
    // make every backfilled message look like a multi-client cc'd thread.
    const selfAddresses = new Set(
      (cfg.knownSelfAddresses ?? [cfg.targetUpn]).map((a) => a.toLowerCase())
    )
    const allClients = (
      await db.contact.findMany({
        where: {
          clientType: { not: null },
          email: { not: null },
        },
        select: { id: true, email: true },
      })
    ).filter((c) => c.email && !selfAddresses.has(c.email.toLowerCase()))

    // Process one message end-to-end: classification, ingest, conflict
    // bookkeeping, and counter updates. Counter mutations happen INSIDE this
    // closure (after the awaits) so processInBatches' per-slice
    // Promise.allSettled boundary doesn't drop them. Each invocation is
    // independent — `allClients` and `deals` are read-only pre-loaded data,
    // and the counter writes are commutative across a slice.
    const processOne = async (message: any): Promise<void> => {
      // Determine recipient list for conflict detection. BCC is generally
      // only visible on Matt's *sent* copies — Graph hides BCC from inbox
      // messages where Matt was BCC'd. Including bccRecipients here is
      // therefore harmless (an empty list on inbound) and catches the case
      // where Matt sent one message BCC'ing two clients.
      const recipients = [
        message.from?.emailAddress?.address,
        ...(message.toRecipients ?? []).map(
          (r: any) => r.emailAddress?.address
        ),
        ...(message.ccRecipients ?? []).map(
          (r: any) => r.emailAddress?.address
        ),
        ...(message.bccRecipients ?? []).map(
          (r: any) => r.emailAddress?.address
        ),
      ].filter(Boolean) as string[]

      const conflict = detectMultiClientConflict({
        recipientEmails: recipients,
        candidateClientContacts: allClients,
        targetContactId: contactId,
      })

      // dealId resolution: which Deal contains receivedDateTime
      const receivedAt = message.receivedDateTime
        ? new Date(message.receivedDateTime)
        : null
      let dealId: string | null = null
      if (receivedAt) {
        const matched = deals.find((d) => {
          const start = new Date(d.createdAt.getTime() - 60 * 60 * 1000) // tolerate 1hr clock skew
          const end = (d.closedAt ?? new Date()).getTime() + 60 * 60 * 1000
          return (
            receivedAt.getTime() >= start.getTime() &&
            receivedAt.getTime() <= end
          )
        })
        dealId = matched?.id ?? null
      }

      try {
        const result = await ingestSingleBackfillMessage({
          message,
          contactId,
          targetUpn: cfg.targetUpn,
          knownSelfAddresses: cfg.knownSelfAddresses,
          dealId,
        })
        if (result.deduped) {
          deduped += 1
        } else {
          ingested += 1
          if (result.communicationId) {
            insertedIds.add(result.communicationId)
          }
          if (
            result.classification === "signal" ||
            result.classification === "uncertain"
          ) {
            scrubQueued += 1
          }
          if (conflict && result.communicationId) {
            multiClientConflicts += 1
            const dedupeKey = `multi-client-match:${result.communicationId}`
            await db.operationalEmailReview.create({
              data: {
                communicationId: result.communicationId,
                // The OperationalEmailReviewType enum has no dedicated
                // multi-client value; `orphaned_context` is the closest
                // semantic fit (ambiguous attribution between contacts).
                type: "orphaned_context",
                status: "open",
                reasonKey: "multi_client_match",
                dedupeKey,
                recommendedAction: "operator_assign_primary_contact",
                policyVersion: POLICY_VERSION,
                metadata: {
                  matchedContactIds: conflict.matchedContactIds,
                  primaryContactId: conflict.primaryContactId,
                } as any,
              },
            })
          }
        }
      } catch (err) {
        // Per-message failures isolated; one bad row in a slice must not
        // abort the others. processInBatches uses allSettled internally so
        // a thrown error here would be captured as a rejected result, but
        // we still log + swallow inline so the caller's view of "failed"
        // stays at zero for known-handled per-message errors and counters
        // simply don't advance.
        console.warn(`[backfill] message ${message.id} ingest failed:`, err)
      }
    }

    for (const window of windows) {
      const messages = await fetchMessagesForContactWindow({
        email: contact.email,
        window,
      })
      messagesDiscovered += messages.length
      if (opts.dryRun) continue

      // Bounded-concurrency parallel ingest. Real-world: 229 messages went
      // from ~6 min sequential to ~75 sec at concurrency=5.
      await processInBatches(messages, INGEST_CONCURRENCY, processOne)
    }

    // Re-extract facts from communications whose last scrub was performed
    // under an older PROMPT_VERSION. Operator-triggered re-scrub keeps the
    // Personal tab in sync with prompt changes (e.g. v6 added the Family /
    // Pets / Hobbies / Sports / Vehicles / Travel / Food / Milestones
    // categories — v5-scrubbed messages would otherwise never surface those
    // facts). Skipped entirely on dryRun.
    let staleRescrubsEnqueued = 0
    let staleRescrubsAvailable = 0
    if (!opts.dryRun) {
      // Exclude the rows we just inserted in this same run — they have no
      // scrub metadata yet (the queue entry was enqueued in-transaction by
      // ingestSingleBackfillMessage but the worker hasn't completed) so the
      // staleness check would otherwise re-enqueue every fresh ingest.
      const insertedIdsList = Array.from(insertedIds)
      const existingComms = await db.communication.findMany({
        where: {
          contactId,
          ...(insertedIdsList.length > 0
            ? { id: { notIn: insertedIdsList } }
            : {}),
        },
        select: { id: true, metadata: true },
      })
      for (const comm of existingComms) {
        const metadata =
          comm.metadata &&
          typeof comm.metadata === "object" &&
          !Array.isArray(comm.metadata)
            ? (comm.metadata as Record<string, unknown>)
            : {}
        const classification =
          typeof metadata.classification === "string"
            ? (metadata.classification as string)
            : null
        // Don't re-extract from noise — facts won't appear in noise messages.
        if (classification === "noise") continue
        // Only signal/uncertain are eligible to flow through the scrub queue.
        if (classification !== "signal" && classification !== "uncertain")
          continue

        const scrub =
          metadata.scrub &&
          typeof metadata.scrub === "object" &&
          !Array.isArray(metadata.scrub)
            ? (metadata.scrub as Record<string, unknown>)
            : null
        const storedVersion =
          scrub && typeof scrub.promptVersion === "string"
            ? (scrub.promptVersion as string)
            : null
        if (!isPromptVersionStale(storedVersion, PROMPT_VERSION)) continue

        // Per-click cap (audit fix May 2026): a v6→v7 prompt bump on a
        // contact with 200 historical comms used to fire 200 fresh
        // DeepSeek calls silently. Once we've enqueued the cap, count
        // remaining stale rows so the UI can prompt the operator to
        // process the next batch on demand.
        if (staleRescrubsEnqueued >= STALE_RESCRUB_PER_CLICK_CAP) {
          staleRescrubsAvailable += 1
          continue
        }

        // ScrubQueue.communicationId is unique — `enqueueScrubForCommunication`
        // would throw P2002 on an existing row. Delete the prior row first
        // (whether previously done, failed, or skipped_sensitive) so the
        // re-enqueue creates a fresh pending entry. This is least-invasive:
        // we don't change `enqueueScrubForCommunication`'s signature or add
        // an upsert path to it.
        try {
          await db.scrubQueue.deleteMany({
            where: { communicationId: comm.id },
          })
          await enqueueScrubForCommunication(db, comm.id, classification)
          staleRescrubsEnqueued += 1
        } catch (err) {
          console.warn(
            `[backfill] stale-rescrub re-enqueue failed for comm ${comm.id}:`,
            err
          )
        }
      }
    }

    return await finalize("succeeded", {
      windowsSearched: windows,
      messagesDiscovered,
      ingested,
      deduped,
      scrubQueued,
      staleRescrubsEnqueued,
      staleRescrubsAvailable,
      multiClientConflicts,
    })
  } catch (err: any) {
    return await finalize(
      "failed",
      { reason: "unexpected_error" },
      err?.message ?? String(err)
    )
  }
}
