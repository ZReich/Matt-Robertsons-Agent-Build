import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import { loadMsgraphConfig } from "@/lib/msgraph/config"
import { enqueueScrubForCommunication } from "@/lib/ai/scrub-queue"
import { PROMPT_VERSION } from "@/lib/ai/scrub-types"

import { detectMultiClientConflict } from "./multi-client-conflict"
import { fetchMessagesForContactWindow } from "./graph-query"
import { ingestSingleBackfillMessage } from "./ingest-message"
import {
  resolveBackfillWindows,
  type BackfillMode,
  type BackfillWindow,
} from "./window-resolver"

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
  multiClientConflicts: number
  durationMs: number
}

const POLICY_VERSION = "mailbox-backfill@1"

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
      multiClientConflicts: 0,
      durationMs: Date.now() - startedAt,
      ...extra,
    }
    await db.backfillRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status,
        result: result as any,
        errorMessage: errorMessage ?? null,
      },
    })
    return result
  }

  try {
    const contact = await db.contact.findUnique({ where: { id: contactId } })
    if (!contact)
      return await finalize("failed", { reason: "contact_not_found" }, "contact_not_found")
    if (!contact.email) return await finalize("skipped", { reason: "no_email_on_file" })

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
      deals: deals.map((d) => ({ createdAt: d.createdAt, closedAt: d.closedAt })),
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

    for (const window of windows) {
      const messages = await fetchMessagesForContactWindow({
        email: contact.email,
        window,
      })
      messagesDiscovered += messages.length
      if (opts.dryRun) continue

      for (const message of messages) {
        // Determine recipient list for conflict detection. BCC is generally
        // only visible on Matt's *sent* copies — Graph hides BCC from inbox
        // messages where Matt was BCC'd. Including bccRecipients here is
        // therefore harmless (an empty list on inbound) and catches the case
        // where Matt sent one message BCC'ing two clients.
        const recipients = [
          message.from?.emailAddress?.address,
          ...(message.toRecipients ?? []).map((r: any) => r.emailAddress?.address),
          ...(message.ccRecipients ?? []).map((r: any) => r.emailAddress?.address),
          ...(message.bccRecipients ?? []).map((r: any) => r.emailAddress?.address),
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
          // Per-message failures isolated; skip to next.
          console.warn(`[backfill] message ${message.id} ingest failed:`, err)
        }
      }
    }

    // Re-extract facts from communications whose last scrub was performed
    // under an older PROMPT_VERSION. Operator-triggered re-scrub keeps the
    // Personal tab in sync with prompt changes (e.g. v6 added the Family /
    // Pets / Hobbies / Sports / Vehicles / Travel / Food / Milestones
    // categories — v5-scrubbed messages would otherwise never surface those
    // facts). Skipped entirely on dryRun.
    let staleRescrubsEnqueued = 0
    if (!opts.dryRun) {
      const existingComms = await db.communication.findMany({
        where: { contactId },
        select: { id: true, metadata: true },
      })
      for (const comm of existingComms) {
        const metadata =
          comm.metadata && typeof comm.metadata === "object" && !Array.isArray(comm.metadata)
            ? (comm.metadata as Record<string, unknown>)
            : {}
        const classification =
          typeof metadata.classification === "string"
            ? (metadata.classification as string)
            : null
        // Don't re-extract from noise — facts won't appear in noise messages.
        if (classification === "noise") continue
        // Only signal/uncertain are eligible to flow through the scrub queue.
        if (classification !== "signal" && classification !== "uncertain") continue

        const scrub =
          metadata.scrub && typeof metadata.scrub === "object" && !Array.isArray(metadata.scrub)
            ? (metadata.scrub as Record<string, unknown>)
            : null
        const storedVersion =
          scrub && typeof scrub.promptVersion === "string"
            ? (scrub.promptVersion as string)
            : null
        if (!isPromptVersionStale(storedVersion, PROMPT_VERSION)) continue

        // ScrubQueue.communicationId is unique — `enqueueScrubForCommunication`
        // would throw P2002 on an existing row. Delete the prior row first
        // (whether previously done, failed, or skipped_sensitive) so the
        // re-enqueue creates a fresh pending entry. This is least-invasive:
        // we don't change `enqueueScrubForCommunication`'s signature or add
        // an upsert path to it.
        try {
          await db.scrubQueue.deleteMany({ where: { communicationId: comm.id } })
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
