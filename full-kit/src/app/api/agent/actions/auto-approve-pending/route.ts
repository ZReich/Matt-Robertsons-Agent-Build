import { NextResponse } from "next/server"

import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"
import {
  AUTO_APPROVE_ACTION_TYPES,
  AgentActionReviewError,
  approveAgentAction,
} from "@/lib/ai/agent-actions"
import { db } from "@/lib/prisma"

interface ApproveResult {
  actionId: string
  ok: boolean
  status?: string
  error?: string
}

/**
 * Bulk auto-approve every pending AgentAction whose actionType is in the
 * AUTO_APPROVE_ACTION_TYPES set (create-todo, mark-todo-done,
 * create-agent-memory). Used to clear out the queue of legacy rows that
 * were created before the auto-approve wiring landed.
 *
 * Idempotent: already-executed rows are skipped via the approve handler's
 * status check. Failures don't poison the batch; each is logged in the
 * response.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    const reviewer = await requireAgentReviewer()

    let body: { limit?: unknown; dryRun?: unknown } = {}
    try {
      body = (await request.json()) as typeof body
    } catch {
      // empty body is fine
    }
    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(2000, Math.floor(body.limit)))
        : 500
    const dryRun = body.dryRun === true

    const candidates = await db.agentAction.findMany({
      where: {
        status: "pending",
        actionType: { in: [...AUTO_APPROVE_ACTION_TYPES] },
      },
      select: { id: true, actionType: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    })

    if (dryRun) {
      const grouped = new Map<string, number>()
      for (const c of candidates) {
        grouped.set(c.actionType, (grouped.get(c.actionType) ?? 0) + 1)
      }
      return NextResponse.json({
        ok: true,
        dryRun: true,
        candidates: candidates.length,
        byType: Object.fromEntries(grouped),
      })
    }

    const results: ApproveResult[] = []
    let executed = 0
    let failed = 0
    for (const c of candidates) {
      try {
        const r = await approveAgentAction({
          id: c.id,
          reviewer: reviewer.label,
        })
        results.push({ actionId: c.id, ok: true, status: r.status })
        if (r.status === "executed") executed++
      } catch (error) {
        const msg =
          error instanceof AgentActionReviewError
            ? `${error.code}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "unknown"
        results.push({ actionId: c.id, ok: false, error: msg })
        failed++
      }
    }

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      executed,
      failed,
      results: results.slice(0, 50),
    })
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }
}
