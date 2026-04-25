import { NextResponse } from "next/server"

import type { DealStage } from "@prisma/client"

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
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const existing = await db.deal.findUnique({
    where: { id },
    select: { id: true, stage: true },
  })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (body.stage !== undefined) {
    if (
      typeof body.stage !== "string" ||
      !DEAL_STAGES.includes(body.stage as DealStage)
    ) {
      return NextResponse.json({ error: "invalid stage" }, { status: 400 })
    }
    data.stage = body.stage
    if (body.stage !== existing.stage) data.stageChangedAt = new Date()
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

  const deal = await db.deal.update({ where: { id }, data })
  return NextResponse.json({ ok: true, deal })
}
