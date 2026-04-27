import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import { ReviewerAuthError, requireAgentReviewer } from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    await requireAgentReviewer()
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }

  const actions = await db.agentAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      actionType: true,
      tier: true,
      status: true,
      summary: true,
      targetEntity: true,
      feedback: true,
      sourceCommunicationId: true,
      promptVersion: true,
      duplicateOfActionId: true,
      dedupedToTodoId: true,
      createdAt: true,
      executedAt: true,
      sourceCommunication: {
        select: { id: true, subject: true, date: true, archivedAt: true },
      },
      todo: { select: { id: true, title: true, status: true } },
      dedupedToTodo: { select: { id: true, title: true, status: true } },
    },
  })
  return NextResponse.json({ actions })
}
