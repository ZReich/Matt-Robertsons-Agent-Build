import type { AgentAction, DealOutcome, DealStage } from "@prisma/client"
import type { AgentActionReviewResult } from "./agent-actions"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

import { AgentActionReviewError } from "./agent-actions"

const ALLOWED_UPDATE_FIELDS = new Set([
  "value",
  "closingDate",
  "listedDate",
  "squareFeet",
  "probability",
  "commissionRate",
  "notes",
  "tags",
  "unit",
])

type MoveStagePayload = {
  dealId: string
  fromStage: DealStage
  toStage: DealStage
  reason: string
  outcome?: DealOutcome
}

type UpdateDealPayload = {
  dealId: string
  fields: Record<string, unknown>
  reason: string
}

type CreateDealPayload = {
  contactId?: string | null
  recipientEmail?: string | null
  recipientDisplayName?: string | null
  dealType: "seller_rep" | "buyer_rep" | "tenant_rep"
  dealSource:
    | "lead_derived"
    | "buyer_rep_inferred"
    | "buildout_event"
    | "ai_suggestion"
    | "manual"
  stage: DealStage
  propertyKey?: string
  propertyAddress?: string
  searchCriteria?: Record<string, unknown>
  reason: string
}

/**
 * SELECT … FOR UPDATE on the agent_actions row. Two reviewers approving
 * the same pending action from two browser tabs would otherwise both
 * complete and double the side effect (two Deals created, two stage moves
 * applied, etc.). Mirrors the lock pattern in
 * markTodoDoneFromAction (agent-actions.ts).
 *
 * Returns:
 *   - { kind: "locked" }     → row is pending; caller should proceed.
 *   - { kind: "executed" }   → row is already executed; caller should
 *     return idempotent { status: "executed" } shape without re-running
 *     the side effect.
 *   - throws AgentActionReviewError for missing rows or invalid statuses.
 */
async function lockAgentActionRow(
  // Prisma TransactionClient typing is loose here on purpose: the test
  // suite hands the same dbMock through $transaction, and at runtime the
  // tx exposes the same surface for our needs.
  tx: { $queryRaw: typeof db.$queryRaw },
  actionId: string
): Promise<{ kind: "locked" } | { kind: "executed" }> {
  const lockedRows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status"::text
    FROM "agent_actions"
    WHERE "id" = ${actionId}
    FOR UPDATE
  `
  const locked = lockedRows[0]
  if (!locked) {
    throw new AgentActionReviewError("action not found", 404, "not_found")
  }
  if (locked.status === "executed") {
    return { kind: "executed" }
  }
  if (locked.status !== "pending") {
    throw new AgentActionReviewError(
      `cannot approve ${locked.status} action`,
      409,
      "invalid_action_status"
    )
  }
  return { kind: "locked" }
}

export async function moveDealStageFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as MoveStagePayload

  const result = await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") {
      return { kind: "already_executed" as const }
    }

    const deal = await tx.deal.findUnique({
      where: { id: payload.dealId },
      select: { id: true, stage: true, contactId: true },
    })
    if (!deal) {
      throw new AgentActionReviewError(`deal ${payload.dealId} not found`, 404)
    }
    if (deal.stage !== payload.fromStage) {
      throw new AgentActionReviewError(
        `stage mismatch: deal is currently ${deal.stage}, action expected ${payload.fromStage}`,
        409,
        "stage_mismatch"
      )
    }

    const data: Record<string, unknown> = {
      stage: payload.toStage,
      stageChangedAt: new Date(),
    }
    if (payload.toStage === "closed") {
      data.closedAt = new Date()
      if (payload.outcome) data.outcome = payload.outcome
    }

    await tx.deal.update({ where: { id: payload.dealId }, data })
    await tx.agentAction.update({
      where: { id: action.id },
      data: { status: "executed", executedAt: new Date() },
    })
    await syncContactRoleFromDeals(
      deal.contactId,
      {
        trigger: "deal_stage_change",
        dealId: payload.dealId,
        sourceAgentActionId: action.id,
      },
      tx
    )
    return { kind: "done" as const }
  })

  if (result.kind === "already_executed") {
    return { status: "executed", todoId: payload.dealId, actionId: action.id }
  }
  return { status: "executed", todoId: payload.dealId, actionId: action.id }
}

export async function updateDealFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as UpdateDealPayload

  const result = await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") {
      return { kind: "already_executed" as const }
    }

    const deal = await tx.deal.findUnique({
      where: { id: payload.dealId },
      select: { id: true },
    })
    if (!deal) {
      throw new AgentActionReviewError(`deal ${payload.dealId} not found`, 404)
    }

    const data: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(payload.fields)) {
      if (!ALLOWED_UPDATE_FIELDS.has(field)) {
        throw new AgentActionReviewError(
          `forbidden field in update-deal payload: ${field}`,
          400,
          "forbidden_update_field"
        )
      }
      if (field === "closingDate" || field === "listedDate") {
        data[field] = typeof value === "string" ? new Date(value) : value
      } else {
        data[field] = value
      }
    }

    await tx.deal.update({ where: { id: payload.dealId }, data })
    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: new Date(),
      },
    })
    return { kind: "done" as const }
  })

  if (result.kind === "already_executed") {
    return { status: "executed", todoId: payload.dealId, actionId: action.id }
  }
  return { status: "executed", todoId: payload.dealId, actionId: action.id }
}

export async function createDealFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as CreateDealPayload

  const result = await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") {
      return { kind: "already_executed" as const, dealId: null }
    }

    let contactId = payload.contactId ?? null
    if (!contactId) {
      if (!payload.recipientEmail) {
        throw new AgentActionReviewError(
          "create-deal payload requires contactId or recipientEmail",
          400
        )
      }
      const email = payload.recipientEmail.toLowerCase()
      const existing = await tx.contact.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          archivedAt: null,
        },
        select: { id: true },
      })
      if (existing) {
        contactId = existing.id
      } else {
        const created = await tx.contact.create({
          data: {
            name: payload.recipientDisplayName?.trim() || email,
            email,
            category: "business",
            tags: ["auto-created-from-buyer-rep-action"],
            createdBy: "agent-action-create-deal",
          },
          select: { id: true },
        })
        contactId = created.id
      }
    }

    // BLOCKER 2: Phase D dedupe at approval time. The 306 pre-existing
    // pending create-deal AgentActions in production were minted before
    // proposeBuyerRepDeal grew its existence guard. Approving any of them
    // through this path must NOT mint a duplicate Deal when the contact
    // already has an active buyer-rep Deal.
    //
    // - archivedAt: null  → archived deals don't block (a fresh re-engagement
    //   should be allowed)
    // - stage: { not: "closed" } → closed deals don't block (re-engagement
    //   after a deal closes is expected; addresses B4 IMPORTANT-finding)
    //
    // We scope the guard to buyer_rep specifically. seller_rep and
    // tenant_rep don't have the same legacy-pending backlog problem, and
    // applying the same guard there could swallow legitimate parallel deals
    // (e.g., one contact representing multiple landlord properties). If
    // those grow a similar problem we can extend, but for now the
    // high-volume case driven by the 306 pending rows is buyer_rep.
    if (payload.dealType === "buyer_rep") {
      const existingDeal = await tx.deal.findFirst({
        where: {
          contactId,
          dealType: "buyer_rep",
          stage: { not: "closed" },
          archivedAt: null,
        },
        select: { id: true },
      })
      if (existingDeal) {
        await tx.agentAction.update({
          where: { id: action.id },
          data: {
            status: "executed",
            executedAt: new Date(),
            feedback: "duplicate-of-existing-deal",
          },
        })
        return { kind: "deduped" as const, dealId: null }
      }
    }

    const deal = await tx.deal.create({
      data: {
        contactId,
        dealType: payload.dealType,
        dealSource: payload.dealSource,
        stage: payload.stage,
        propertyKey: payload.propertyKey,
        propertyAddress: payload.propertyAddress,
        searchCriteria: payload.searchCriteria as never,
      },
      select: { id: true },
    })
    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: new Date(),
      },
    })
    return { kind: "done" as const, dealId: deal.id, contactId }
  })

  if (result.kind === "already_executed") {
    return { status: "executed", actionId: action.id }
  }
  if (result.kind === "deduped") {
    return { status: "executed", actionId: action.id }
  }
  // syncContactRoleFromDeals runs OUTSIDE the locked tx because it can
  // trigger its own internal writes/audit-action creation; it remains
  // idempotent and is safe to call after commit.
  await syncContactRoleFromDeals(result.contactId)
  return { status: "executed", todoId: result.dealId, actionId: action.id }
}
