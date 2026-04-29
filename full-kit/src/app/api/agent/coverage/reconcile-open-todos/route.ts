import { NextResponse } from "next/server"
import { z } from "zod"

import {
  ReconciliationInputError,
  reconcileOpenTodosFromOutbound,
} from "@/lib/ai/outbound-todo-reconciliation"
import { COVERAGE_POLICY_VERSION } from "@/lib/coverage/communication-coverage"
import { recordCoverageActionAudit } from "@/lib/coverage/coverage-observability"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

const payloadSchema = z
  .object({
    mode: z.enum(["dry-run", "write"]),
    runId: z.string().optional(),
    limit: z.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict()

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    const reviewer = await requireAgentReviewer()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "invalid JSON body" },
        { status: 400 }
      )
    }
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const result = await reconcileOpenTodosFromOutbound(parsed.data)
    await recordCoverageActionAudit({
      actor: reviewer.label,
      action: "reconcile_open_todos_from_outbound",
      runId: result.runId ?? parsed.data.runId ?? null,
      dryRun: parsed.data.mode === "dry-run",
      policyVersion: COVERAGE_POLICY_VERSION,
      reviewItemIds: [],
      outcome: {
        applied:
          parsed.data.mode === "dry-run"
            ? result.candidateCount
            : result.createdActionCount,
        skipped:
          parsed.data.mode === "dry-run" ? 0 : result.duplicateSuppressedCount,
        unsupported: 0,
      },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    if (error instanceof ReconciliationInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}
