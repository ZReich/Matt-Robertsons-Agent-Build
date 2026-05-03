import { NextResponse } from "next/server"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import {
  getAutomationSettings,
  setAutomationSettings,
} from "@/lib/system-state/automation-settings"

export async function GET(): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const settings = await getAutomationSettings()
  return NextResponse.json({ settings })
}

export async function PATCH(request: Request): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if ("autoSendNewLeadReplies" in body) {
    if (typeof body.autoSendNewLeadReplies !== "boolean") {
      return NextResponse.json(
        { error: "autoSendNewLeadReplies must be boolean" },
        { status: 400 }
      )
    }
    patch.autoSendNewLeadReplies = body.autoSendNewLeadReplies
  }
  if ("autoSendDailyMatchReplies" in body) {
    if (typeof body.autoSendDailyMatchReplies !== "boolean") {
      return NextResponse.json(
        { error: "autoSendDailyMatchReplies must be boolean" },
        { status: 400 }
      )
    }
    patch.autoSendDailyMatchReplies = body.autoSendDailyMatchReplies
  }
  if ("autoMatchScoreThreshold" in body) {
    const n = Number(body.autoMatchScoreThreshold)
    if (!Number.isFinite(n) || n < 50 || n > 100) {
      return NextResponse.json(
        { error: "autoMatchScoreThreshold must be 50-100" },
        { status: 400 }
      )
    }
    patch.autoMatchScoreThreshold = n
  }
  if ("dailyMatchPerContactCap" in body) {
    const n = Number(body.dailyMatchPerContactCap)
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      return NextResponse.json(
        { error: "dailyMatchPerContactCap must be 1-20" },
        { status: 400 }
      )
    }
    patch.dailyMatchPerContactCap = n
  }
  if ("leaseRenewalLookaheadMonths" in body) {
    const n = Number(body.leaseRenewalLookaheadMonths)
    if (!Number.isFinite(n) || n < 1 || n > 24) {
      return NextResponse.json(
        { error: "leaseRenewalLookaheadMonths must be 1-24" },
        { status: 400 }
      )
    }
    patch.leaseRenewalLookaheadMonths = n
  }
  if ("autoSendLeaseRenewalReplies" in body) {
    if (typeof body.autoSendLeaseRenewalReplies !== "boolean") {
      return NextResponse.json(
        { error: "autoSendLeaseRenewalReplies must be boolean" },
        { status: 400 }
      )
    }
    patch.autoSendLeaseRenewalReplies = body.autoSendLeaseRenewalReplies
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no editable fields provided" },
      { status: 400 }
    )
  }

  const next = await setAutomationSettings(patch)
  return NextResponse.json({ ok: true, settings: next })
}
