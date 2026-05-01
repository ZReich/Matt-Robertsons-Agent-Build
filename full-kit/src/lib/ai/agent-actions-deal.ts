import type { AgentAction, DealStage, DealOutcome } from "@prisma/client"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

import { AgentActionReviewError } from "./agent-actions"
import type { AgentActionReviewResult } from "./agent-actions"

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

export async function moveDealStageFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as MoveStagePayload

  await db.$transaction(async (tx) => {
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
  })

  return { status: "executed", todoId: payload.dealId, actionId: action.id }
}

export async function updateDealFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as UpdateDealPayload
  const deal = await db.deal.findUnique({
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

  await db.deal.update({ where: { id: payload.dealId }, data })
  await db.agentAction.update({
    where: { id: action.id },
    data: {
      status: "executed",
      executedAt: new Date(),
    },
  })
  return { status: "executed", todoId: payload.dealId, actionId: action.id }
}

export async function createDealFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as CreateDealPayload
  let contactId = payload.contactId ?? null
  if (!contactId) {
    if (!payload.recipientEmail) {
      throw new AgentActionReviewError(
        "create-deal payload requires contactId or recipientEmail",
        400
      )
    }
    const email = payload.recipientEmail.toLowerCase()
    const existing = await db.contact.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
    })
    if (existing) {
      contactId = existing.id
    } else {
      const created = await db.contact.create({
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
  const deal = await db.deal.create({
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
  await db.agentAction.update({
    where: { id: action.id },
    data: {
      status: "executed",
      executedAt: new Date(),
    },
  })
  await syncContactRoleFromDeals(contactId)
  return { status: "executed", todoId: deal.id, actionId: action.id }
}
