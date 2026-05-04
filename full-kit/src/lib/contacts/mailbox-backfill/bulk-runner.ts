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

export async function runBulkBackfill(input: BulkInput): Promise<BulkResult> {
  const mode: BackfillMode = input.mode ?? "deal-anchored"
  const trigger = input.trigger ?? "bulk"
  const delay = input.delayBetweenMs ?? 500

  const parent = await db.backfillRun.create({
    data: { trigger, mode, status: "running" },
  })

  let contactIds = input.contactIds
  if (!contactIds || contactIds.length === 0) {
    const candidates = await db.contact.findMany({
      where: {
        clientType: { in: CLIENT_TYPES as unknown as any[] },
        email: { not: null },
        communications: { none: {} },
      },
      select: { id: true },
    })
    contactIds = candidates.map((c) => c.id)
  }

  const result: BulkResult = {
    parentRunId: parent.id,
    totalContacts: contactIds.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalMessagesIngested: 0,
    totalScrubQueued: 0,
    failures: [],
    skips: [],
  }

  for (const cid of contactIds) {
    try {
      const r = await backfillMailboxForContact(cid, {
        mode,
        trigger,
        parentRunId: parent.id,
        dryRun: input.dryRun,
      })
      if (r.status === "succeeded") {
        result.succeeded += 1
        result.totalMessagesIngested += r.ingested
        result.totalScrubQueued += r.scrubQueued
      } else if (r.status === "skipped") {
        result.skipped += 1
        result.skips.push({ contactId: cid, reason: r.reason ?? "unknown" })
      } else {
        result.failed += 1
        result.failures.push({
          contactId: cid,
          error: r.reason ?? "unknown",
        })
      }
    } catch (err) {
      // BackfillAlreadyRunningError is the partial-unique safety net firing —
      // another orchestrator is already mid-run for this contact. Treat as a
      // soft skip so the bulk run doesn't get marked failed for what is
      // really a "come back later" condition.
      if (err instanceof BackfillAlreadyRunningError) {
        result.skipped += 1
        result.skips.push({ contactId: cid, reason: "already_running" })
      } else {
        const message =
          err instanceof Error ? err.message : String(err ?? "unknown")
        result.failed += 1
        result.failures.push({ contactId: cid, error: message })
      }
    }
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
  }

  await db.backfillRun.update({
    where: { id: parent.id },
    data: {
      finishedAt: new Date(),
      status: "succeeded",
      result: result as any,
    },
  })

  return result
}
