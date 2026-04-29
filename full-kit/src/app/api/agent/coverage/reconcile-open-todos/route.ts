import { NextResponse } from "next/server"
import { z } from "zod"

import {
  ReconciliationInputError,
  reconcileOpenTodosFromOutbound,
} from "@/lib/ai/outbound-todo-reconciliation"
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
    await requireAgentReviewer()
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
