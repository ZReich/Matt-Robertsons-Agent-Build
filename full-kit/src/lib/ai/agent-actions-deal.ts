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

export async function moveDealStageFromAction(
  action: Pick<AgentAction, "id" | "actionType" | "payload">,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = action.payload as MoveStagePayload
  const deal = await db.deal.findUnique({
    where: { id: payload.dealId },
    select: { id: true, stage: true },
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

  await db.deal.update({ where: { id: payload.dealId }, data })
  await db.agentAction.update({
    where: { id: action.id },
    data: {
      status: "executed",
      executedAt: new Date(),
    },
  })

  const dealAfter = await db.deal.findUnique({
    where: { id: payload.dealId },
    select: { contactId: true },
  })
  if (dealAfter) await syncContactRoleFromDeals(dealAfter.contactId)

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
