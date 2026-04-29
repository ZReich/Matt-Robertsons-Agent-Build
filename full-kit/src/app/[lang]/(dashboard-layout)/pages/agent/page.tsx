import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import type { Metadata } from "next"

import { getScrubCoverageStats } from "@/lib/ai"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { requireAgentReviewer } from "@/lib/reviewer-auth"

import { Button } from "@/components/ui/button"
import { AgentControlCenter } from "./_components/agent-control-center"

export const metadata: Metadata = {
  title: "Agent Control Center",
}

export const dynamic = "force-dynamic"

type AgentPageProps = {
  params: Promise<{ lang: string }>
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { lang } = await params
  try {
    await requireAgentReviewer()
  } catch {
    const session = await getSession()
    return <AgentAccessDenied lang={lang} email={session?.user?.email} />
  }

  const [actions, memory, coverage] = await Promise.all([
    db.agentAction.findMany({
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
    }),
    db.agentMemory.findMany({
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true,
        title: true,
        content: true,
        memoryType: true,
        priority: true,
        updatedAt: true,
      },
    }),
    getScrubCoverageStats(),
  ])
  const snoozes = await db.todoReminderPolicy.findMany({
    where: {
      state: "snoozed",
      agentActionId: { in: actions.map((action) => action.id) },
    },
    select: { agentActionId: true },
  })
  const snoozedActionIds = new Set(
    snoozes.map((snooze) => snooze.agentActionId).filter(Boolean)
  )
  const targetTodoIds = actions
    .map((action) =>
      action.targetEntity?.startsWith("todo:")
        ? action.targetEntity.slice("todo:".length)
        : null
    )
    .filter(Boolean) as string[]
  const targetTodos =
    targetTodoIds.length > 0
      ? await db.todo.findMany({
          where: { id: { in: targetTodoIds } },
          select: {
            id: true,
            title: true,
            status: true,
            contactId: true,
            dealId: true,
          },
        })
      : []
  const targetTodoById = new Map(targetTodos.map((todo) => [todo.id, todo]))
  const initialActions = actions.map((action) => ({
    id: action.id,
    actionType: action.actionType,
    tier: action.tier,
    status:
      action.status === "pending" && snoozedActionIds.has(action.id)
        ? ("snoozed" as const)
        : action.status,
    summary: action.summary,
    targetEntity: action.targetEntity,
    feedback: action.feedback,
    sourceCommunicationId: action.sourceCommunicationId,
    promptVersion: action.promptVersion,
    duplicateOfActionId: action.duplicateOfActionId,
    dedupedToTodoId: action.dedupedToTodoId,
    createdAt: action.createdAt.toISOString(),
    executedAt: action.executedAt?.toISOString() ?? null,
    sourceCommunication: action.sourceCommunication
      ? {
          id: action.sourceCommunication.id,
          subject: action.sourceCommunication.subject,
          date: action.sourceCommunication.date.toISOString(),
          archivedAt:
            action.sourceCommunication.archivedAt?.toISOString() ?? null,
        }
      : null,
    todo: action.todo,
    targetTodo: action.targetEntity?.startsWith("todo:")
      ? (targetTodoById.get(action.targetEntity.slice("todo:".length)) ?? null)
      : null,
    dedupedToTodo: action.dedupedToTodo,
  }))
  const initialMemory = memory.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    memoryType: item.memoryType,
    priority: item.priority,
    updatedAt: item.updatedAt.toISOString(),
  }))

  return (
    <section className="container grid gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Agent Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Manage approvals, review activity, and configure agent behavior.
        </p>
      </div>

      <AgentControlCenter
        initialActions={initialActions}
        initialMemory={initialMemory}
        coverage={coverage}
      />
    </section>
  )
}

function AgentAccessDenied({
  lang,
  email,
}: {
  lang: string
  email: string | null | undefined
}) {
  return (
    <section className="container grid min-h-[60vh] place-items-center p-6">
      <div className="grid max-w-xl gap-5 rounded-md border bg-background p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              Agent access is restricted
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email || "an account that is not allowed"}.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          This queue only opens for configured agent reviewers.
        </p>

        <Button variant="outline" asChild>
          <Link href={`/${lang}/dashboards/home`}>Back to Home</Link>
        </Button>
      </div>
    </section>
  )
}
