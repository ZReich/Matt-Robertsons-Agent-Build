import type { DealStage, Prisma } from "@prisma/client"

import { containsSensitiveContent } from "@/lib/ai/sensitive-filter"
import { normalizeBuildoutProperty } from "@/lib/buildout/property-normalizer"
import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import {
  mapBuildoutStageToDealOutcome,
  mapBuildoutStageToDealStage,
} from "@/lib/msgraph/buildout-stage-parser"
import { extractBuildoutEvent } from "@/lib/msgraph/email-extractors"
import { db } from "@/lib/prisma"

export type ProcessBuildoutStageUpdateResult =
  | {
      status: "executed"
      actionId: string
      dealId: string
      fromStage: DealStage
      toStage: DealStage
    }
  | { status: "already-processed"; previous: Record<string, unknown> }
  | { status: "sensitive-filtered"; reasons: string[] }
  | { status: "not-a-stage-update"; reason: string }
  | { status: "deal-not-found"; propertyKey: string }
  | {
      status: "stage-divergence"
      dealId: string
      currentStage: DealStage
      expectedFromStage: DealStage
    }
  | { status: "comm-not-found" }
  | { status: "non-buildout-source"; observedSource: string | null }
  | {
      status: "stage-collapsed"
      stage: DealStage
      fromStageRaw: string
      toStageRaw: string
      collapsedTo: DealStage
    }

/**
 * The classification source value `email-filter.ts` stamps on
 * `Communication.metadata.source` when an inbound message comes from
 * Buildout's notification senders with one of the allowlisted subjects.
 * Used as a defense-in-depth gate so subject/body matching alone can't
 * trigger a stage move on a forged or misclassified row.
 */
export const BUILDOUT_EVENT_METADATA_SOURCE = "buildout-event"

type CommSlim = {
  id: string
  subject: string | null
  body: string | null
  metadata: unknown
}

type DealSlim = {
  id: string
  stage: DealStage
  contactId: string
}

/**
 * Phase B processor: Buildout deal-stage email → deterministic move-deal-stage
 * AgentAction (tier="auto", status="executed") + Deal stage update + idempotency
 * stamp, all in a single transaction.
 *
 * Side-effects on the source Communication:
 *   metadata.buildoutStageUpdate = {
 *     processedAt, dealId?, oldStage?, newStage?, skippedReason?
 *   }
 *
 * Re-runs are no-ops (status="already-processed") once any stamp is present.
 */
export async function processBuildoutStageUpdate(
  communicationId: string
): Promise<ProcessBuildoutStageUpdateResult> {
  const comm = (await db.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, subject: true, body: true, metadata: true },
  })) as CommSlim | null
  if (!comm) return { status: "comm-not-found" }

  const meta = (comm.metadata as Record<string, unknown> | null) ?? {}
  const previousStamp = meta.buildoutStageUpdate as
    | Record<string, unknown>
    | undefined
  if (previousStamp) {
    return { status: "already-processed", previous: previousStamp }
  }

  // 0. Defense-in-depth source check. The live ingest path only stamps
  //    metadata.source = "buildout-event" when email-filter.ts has already
  //    confirmed the sender is support@buildout.com /
  //    no-reply-notification@buildout.com with an allowlisted subject. Without
  //    this check, the sweep + single-row API endpoints would happily process
  //    any Communication whose subject regex matched, which is exactly what a
  //    forged / misclassified row would look like.
  const observedSource =
    typeof meta.source === "string" ? (meta.source as string) : null
  if (observedSource !== BUILDOUT_EVENT_METADATA_SOURCE) {
    await stampSkip(comm.id, meta, {
      skippedReason: "non-buildout-source",
      observedSource,
    })
    return { status: "non-buildout-source", observedSource }
  }

  // 1. Sensitive filter (subject + body) — bail and stamp so we don't re-scan.
  const sensitivity = containsSensitiveContent(comm.subject, comm.body)
  if (sensitivity.tripped) {
    await stampSkip(comm.id, meta, {
      skippedReason: "sensitive-filter",
      reasons: sensitivity.reasons,
    })
    return { status: "sensitive-filtered", reasons: sensitivity.reasons }
  }

  // 2. Classifier + 3. Parser — both via the existing extractor.
  const extracted = extractBuildoutEvent({
    subject: comm.subject ?? "",
    bodyText: comm.body ?? "",
  })
  if (
    !extracted ||
    extracted.kind !== "deal-stage-update" ||
    !extracted.fromStageRaw ||
    !extracted.toStageRaw ||
    !extracted.propertyName
  ) {
    return {
      status: "not-a-stage-update",
      reason: "extractor-null-or-missing-fields",
    }
  }
  const fromStageRaw: string = extracted.fromStageRaw
  const toStageRaw: string = extracted.toStageRaw
  const fromStage = mapBuildoutStageToDealStage(fromStageRaw)
  const toStage = mapBuildoutStageToDealStage(toStageRaw)
  if (!fromStage || !toStage) {
    return {
      status: "not-a-stage-update",
      reason: `unmappable-stage:${fromStageRaw}->${toStageRaw}`,
    }
  }

  // 3.5 Stage-collapse guard. Some Buildout labels collapse to the same
  // internal DealStage — e.g. Sourcing and Evaluating both map to
  // `prospecting`. A "Sourcing → Evaluating" Buildout email would, without
  // this guard, parse as `fromStage == toStage == prospecting` and (assuming
  // the deal is at prospecting) create a no-op `move-deal-stage` AgentAction
  // that just bumps `stageChangedAt`. That pollutes the audit log with
  // executed actions that didn't actually move the deal anywhere. Stamp
  // idempotency and bail before the tx so re-runs no-op too.
  if (fromStage === toStage) {
    await stampSkip(comm.id, meta, {
      skippedReason: "stage-collapsed",
      collapsedTo: fromStage,
      fromStageRaw,
      toStageRaw,
    })
    return {
      status: "stage-collapsed",
      stage: fromStage,
      fromStageRaw,
      toStageRaw,
      collapsedTo: fromStage,
    } as const
  }

  // 4. Resolve canonical propertyKey from extractor result.
  //    Pass an empty body — the body of these emails contains the transition
  //    phrase ("was updated from X to Y") which `firstAddress` then mistakes
  //    for an address fragment and pollutes the key.
  const normalized = normalizeBuildoutProperty(extracted.propertyName, "")
  if (!normalized) {
    return { status: "not-a-stage-update", reason: "property-key-empty" }
  }
  const propertyKey = normalized.normalizedPropertyKey

  // 5+6+7+8 inside a single tx so partial failures never leave the AgentAction
  // and Deal out of sync.
  return await db.$transaction(async (tx) => {
    // Acquire a Postgres advisory transaction lock keyed on the
    // Communication id. Two concurrent callers (live ingest + manual sweep,
    // or two sweep retries) racing on the same row will serialize here:
    // whichever wins enters first, runs the in-tx metadata re-read, sees no
    // stamp, mutates Deal+AgentAction, stamps. The loser blocks until the
    // first commits, then re-reads the in-tx metadata, sees the stamp, and
    // returns `already-processed` without writing anything. Without this,
    // the pre-tx `previousStamp` short-circuit alone allows two callers to
    // both observe `previousStamp = undefined` and both create executed
    // AgentActions for the same move.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${comm.id}))`

    // In-tx re-read. The pre-tx read happens before we hold the lock, so a
    // concurrent caller may have stamped between then and now. Re-read
    // inside the locked tx and short-circuit if so. We also use this fresh
    // metadata as the base for the eventual stamp write so any concurrent
    // unrelated metadata updates aren't clobbered (the pre-tx `meta` would
    // be stale).
    const fresh = (await tx.communication.findUnique({
      where: { id: comm.id },
      select: { metadata: true },
    })) as { metadata: unknown } | null
    const freshMeta = ((fresh?.metadata as Record<string, unknown> | null) ??
      {}) as Record<string, unknown>
    if (freshMeta.buildoutStageUpdate) {
      return {
        status: "already-processed",
        previous: freshMeta.buildoutStageUpdate as Record<string, unknown>,
      } as const
    }

    const deal = (await tx.deal.findFirst({
      where: {
        propertyKey,
        dealType: "seller_rep",
        archivedAt: null,
      },
      select: { id: true, stage: true, contactId: true },
    })) as DealSlim | null

    if (!deal) {
      await stampSkip(
        comm.id,
        freshMeta,
        {
          skippedReason: "deal-not-found",
          propertyKey,
          fromStageRaw: fromStageRaw,
          toStageRaw: toStageRaw,
        },
        tx
      )
      return { status: "deal-not-found", propertyKey } as const
    }

    if (deal.stage !== fromStage) {
      await stampSkip(
        comm.id,
        freshMeta,
        {
          skippedReason: "stage-divergence",
          dealId: deal.id,
          currentStage: deal.stage,
          expectedFromStage: fromStage,
          attemptedToStage: toStage,
        },
        tx
      )
      return {
        status: "stage-divergence",
        dealId: deal.id,
        currentStage: deal.stage,
        expectedFromStage: fromStage,
      } as const
    }

    // Outcome derives from the *raw* Buildout stage label so "Dead" → lost
    // and "Closed" → won. Non-terminal stages leave outcome unset.
    const outcome = mapBuildoutStageToDealOutcome(toStageRaw) ?? undefined
    const summary = `Auto-mirror Buildout stage move: ${extracted.propertyName} ${fromStage} → ${toStage}`
    const action = await tx.agentAction.create({
      data: {
        actionType: "move-deal-stage",
        tier: "auto",
        status: "executed",
        executedAt: new Date(),
        summary,
        targetEntity: `deal:${deal.id}`,
        sourceCommunicationId: comm.id,
        promptVersion: "buildout-stage-parser-deterministic",
        payload: {
          dealId: deal.id,
          fromStage,
          toStage,
          reason: "Buildout deal-stage update",
          ...(outcome ? { outcome } : {}),
          source: "buildout-email",
          fromStageRaw: fromStageRaw,
          toStageRaw: toStageRaw,
          propertyKey,
        },
      },
      select: { id: true },
    })

    const dealData: Record<string, unknown> = {
      stage: toStage,
      stageChangedAt: new Date(),
    }
    if (toStage === "closed") {
      dealData.closedAt = new Date()
      if (outcome) dealData.outcome = outcome
    }
    await tx.deal.update({
      where: { id: deal.id },
      data: dealData,
    })

    await syncContactRoleFromDeals(
      deal.contactId,
      {
        trigger: "deal_stage_change",
        dealId: deal.id,
        sourceAgentActionId: action.id,
        sourceCommunicationId: comm.id,
      },
      tx
    )

    const stamp = {
      processedAt: new Date().toISOString(),
      dealId: deal.id,
      oldStage: fromStage,
      newStage: toStage,
      actionId: action.id,
    }
    await tx.communication.update({
      where: { id: comm.id },
      data: {
        metadata: {
          ...freshMeta,
          buildoutStageUpdate: stamp,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    return {
      status: "executed",
      actionId: action.id,
      dealId: deal.id,
      fromStage,
      toStage,
    } as const
  })
}

async function stampSkip(
  communicationId: string,
  baseMeta: Record<string, unknown>,
  payload: Record<string, unknown>,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const stamp = {
    processedAt: new Date().toISOString(),
    ...payload,
  }
  const writer = tx ?? db
  await writer.communication.update({
    where: { id: communicationId },
    data: {
      metadata: {
        ...baseMeta,
        buildoutStageUpdate: stamp,
      } as unknown as Prisma.InputJsonValue,
    },
  })
}

// ---------------------------------------------------------------------------
// Backward-compat shim for the existing lead-apply-backfill caller.
// Older signature accepted (communicationId, propertyName, fromStageRaw,
// toStageRaw); new signature derives all of those from the Communication itself.
// We keep an export under the old name so the migration step can proceed in
// pieces and downstream calls keep compiling.
// ---------------------------------------------------------------------------

export type ProposeStageMoveInput = {
  communicationId: string
}

export async function proposeStageMoveFromBuildoutEmail(
  input: ProposeStageMoveInput
): Promise<{ created: boolean; actionId: string | null; status: string }> {
  const result = await processBuildoutStageUpdate(input.communicationId)
  if (result.status === "executed") {
    return { created: true, actionId: result.actionId, status: result.status }
  }
  return { created: false, actionId: null, status: result.status }
}

// ---------------------------------------------------------------------------
// Sweep helper used by the API route and the live-ingest hook.
// ---------------------------------------------------------------------------

export interface SweepOptions {
  lookbackDays?: number
  limit?: number
}

export interface SweepResultSummary {
  candidates: number
  processed: number
  executed: number
  byStatus: Record<string, number>
  results: Array<ProcessBuildoutStageUpdateResult & { communicationId: string }>
}

export async function processUnprocessedBuildoutStageUpdates(
  options: SweepOptions = {}
): Promise<SweepResultSummary> {
  const { lookbackDays = 7, limit = 100 } = options
  const since = new Date()
  since.setDate(since.getDate() - lookbackDays)

  // Subject regex pulled from email-extractors.ts: BUILDOUT_STAGE
  // /^deal stage updated on\s+(.+)$/i. Postgres `mode: insensitive` + a
  // `startsWith`-style match gets us close enough; the processor itself
  // re-validates via extractBuildoutEvent so false positives at this stage
  // are no-ops (status: "not-a-stage-update").
  //
  // Defense-in-depth: also restrict to Communications whose metadata.source
  // is `buildout-event` (stamped by email-filter.ts only after the sender +
  // subject upstream check passed). Subject-pattern matches without that
  // source tag are filtered at the processor level too, but skipping the
  // fetch keeps forged/misclassified rows from showing up in sweep telemetry.
  const candidates = await db.communication.findMany({
    where: {
      direction: "inbound",
      date: { gte: since },
      archivedAt: null,
      subject: { startsWith: "Deal stage updated", mode: "insensitive" },
      metadata: {
        path: ["source"],
        equals: BUILDOUT_EVENT_METADATA_SOURCE,
      },
    },
    select: { id: true, metadata: true },
    orderBy: { date: "desc" },
    take: limit,
  })

  const unprocessed = candidates.filter((c) => {
    const meta = c.metadata as Record<string, unknown> | null
    return !meta?.buildoutStageUpdate
  })

  const byStatus: Record<string, number> = {}
  let executed = 0
  const results: Array<
    ProcessBuildoutStageUpdateResult & { communicationId: string }
  > = []
  for (const c of unprocessed) {
    const r = await processBuildoutStageUpdate(c.id)
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    if (r.status === "executed") executed++
    results.push({ ...r, communicationId: c.id })
  }
  return {
    candidates: candidates.length,
    processed: results.length,
    executed,
    byStatus,
    results,
  }
}
