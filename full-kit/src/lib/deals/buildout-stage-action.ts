import type { DealStage, Prisma } from "@prisma/client"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { normalizeBuildoutProperty } from "@/lib/buildout/property-normalizer"
import { containsSensitiveContent } from "@/lib/ai/sensitive-filter"
import { extractBuildoutEvent } from "@/lib/msgraph/email-extractors"
import {
  mapBuildoutStageToDealOutcome,
  mapBuildoutStageToDealStage,
} from "@/lib/msgraph/buildout-stage-parser"
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
        meta,
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
        meta,
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
          ...meta,
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
  results: Array<
    ProcessBuildoutStageUpdateResult & { communicationId: string }
  >
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
  const candidates = await db.communication.findMany({
    where: {
      direction: "inbound",
      date: { gte: since },
      archivedAt: null,
      subject: { startsWith: "Deal stage updated", mode: "insensitive" },
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
