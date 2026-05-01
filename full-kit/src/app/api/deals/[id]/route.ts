import { NextResponse } from "next/server"

import type { DealStage } from "@prisma/client"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { DEAL_STAGES } from "@/lib/pipeline/stage-probability"
import { db } from "@/lib/prisma"

function parseNumber(value: unknown) {
  if (value === null) return null
  if (value === undefined || value === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const csrfRejection = validateJsonMutationRequest(request)
  if (csrfRejection) return csrfRejection

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (body.stage !== undefined) {
    if (
      typeof body.stage !== "string" ||
      !DEAL_STAGES.includes(body.stage as DealStage)
    ) {
      return NextResponse.json({ error: "invalid stage" }, { status: 400 })
    }
    data.stage = body.stage
  }

  if (body.probability !== undefined) {
    const probability = parseNumber(body.probability)
    if (
      probability === undefined ||
      (probability !== null &&
        (!Number.isInteger(probability) ||
          probability < 0 ||
          probability > 100))
    ) {
      return NextResponse.json(
        { error: "probability must be 0-100" },
        { status: 400 }
      )
    }
    data.probability = probability
  }

  if (body.commissionRate !== undefined) {
    const commissionRate = parseNumber(body.commissionRate)
    if (
      commissionRate === undefined ||
      (commissionRate !== null &&
        (Number.isNaN(commissionRate) ||
          commissionRate < 0 ||
          commissionRate > 1))
    ) {
      return NextResponse.json(
        { error: "commissionRate must be 0-1" },
        { status: 400 }
      )
    }
    data.commissionRate = commissionRate
  }

  if (body.value !== undefined) {
    const value = parseNumber(body.value)
    if (
      value === undefined ||
      (value !== null && (Number.isNaN(value) || value < 0))
    ) {
      return NextResponse.json(
        { error: "value must be non-negative" },
        { status: 400 }
      )
    }
    data.value = value
  }

  const result = await db.$transaction(async (tx) => {
    // Read the deal's current stage inside the transaction so concurrent
    // PATCH requests can't race on the close-detection logic.
    const existing = await tx.deal.findUnique({
      where: { id },
      select: { id: true, stage: true, contactId: true },
    })
    if (!existing) {
      return { ok: false as const, status: 404, error: "not found" }
    }

    const finalData: Record<string, unknown> = { ...data }
    const stageChanged =
      data.stage !== undefined && data.stage !== existing.stage
    if (stageChanged) finalData.stageChangedAt = new Date()

    const deal = await tx.deal.update({ where: { id }, data: finalData })

    // Recompute clientType from the contact's full deal history. Captures
    // close → past_client, re-open → active_*, and everything in between.
    const promotion = stageChanged
      ? await syncContactRoleFromDeals(
          existing.contactId,
          { trigger: "deal_stage_change", dealId: id },
          tx
        )
      : null

    // If the human just applied a stage change, any pending AI proposal to
    // move this deal's stage is now stale. Resolve them so the review queue
    // doesn't show perpetual pending proposals against a deal whose stage
    // is already reconciled.
    if (stageChanged) {
      await tx.agentAction.updateMany({
        where: {
          actionType: "move-deal-stage",
          status: "pending",
          targetEntity: `deal:${id}`,
        },
        data: {
          status: "executed",
          executedAt: new Date(),
          feedback: `Reconciled: human applied stage change to "${data.stage}" via PATCH.`,
        },
      })
    }

    return { ok: true as const, deal, promotion }
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }
  return NextResponse.json({
    ok: true,
    deal: result.deal,
    promotion: result.promotion,
  })
}
