import type { TodoMeta, VaultNote } from "@/lib/vault"
import type { Priority, Prisma, TodoStatus } from "@prisma/client"

import { db } from "@/lib/prisma"
import { resolvePrismaTodoContexts } from "@/lib/vault/resolve-context"

import { getPrismaTodoId, prismaTodoPath } from "./paths"

export { PRISMA_TODO_PATH_PREFIX, isPrismaTodoPath } from "./paths"

const TODO_CONTEXT_INCLUDE = {
  contact: {
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      role: true,
      preferredContact: true,
    },
  },
  deal: {
    select: {
      id: true,
      propertyAddress: true,
      propertyType: true,
      stage: true,
      value: true,
      squareFeet: true,
      closingDate: true,
      keyContacts: true,
      contact: { select: { name: true } },
    },
  },
  communication: {
    select: {
      id: true,
      channel: true,
      subject: true,
      date: true,
      externalMessageId: true,
      createdBy: true,
      metadata: true,
      contact: { select: { name: true } },
      deal: { select: { propertyAddress: true } },
    },
  },
} satisfies Prisma.TodoInclude

type TodoWithContext = Prisma.TodoGetPayload<{
  include: typeof TODO_CONTEXT_INCLUDE
}>

export type PrismaTodoNotesWithContexts = {
  notes: Array<VaultNote<TodoMeta>>
  contexts: ReturnType<typeof resolvePrismaTodoContexts>
}

export async function listPrismaTodoNotesWithContexts(): Promise<PrismaTodoNotesWithContexts> {
  return listPrismaTodoNotesWithContextsWhere({ archivedAt: null })
}

export async function listDashboardPrismaTodoNotesWithContexts(
  now = new Date()
): Promise<PrismaTodoNotesWithContexts> {
  return listPrismaTodoNotesWithContextsWhere({
    archivedAt: null,
    status: { in: ["pending", "in_progress"] },
    OR: [
      { priority: { in: ["urgent", "high"] } },
      { dueDate: { lt: startOfNextDay(now) } },
    ],
  })
}

export async function listPrismaTodoNotes(): Promise<
  Array<VaultNote<TodoMeta>>
> {
  const { notes } = await listPrismaTodoNotesWithContexts()
  return notes
}

export async function updatePrismaTodoFromVaultPath(
  path: string,
  updates: Partial<TodoMeta>
) {
  const id = getPrismaTodoId(path)
  if (!id) return null

  try {
    const todo = await db.todo.update({
      where: { id },
      data: {
        status: mapVaultStatusToPrisma(updates.status),
        priority: mapPriority(updates.priority),
        dueDate: updates.due_date ? new Date(updates.due_date) : undefined,
      },
      include: TODO_CONTEXT_INCLUDE,
    })
    return toVaultTodoNote(todo)
  } catch (err) {
    if (isPrismaRecordNotFoundError(err)) return null
    throw err
  }
}

export async function archivePrismaTodoFromVaultPath(path: string) {
  const id = getPrismaTodoId(path)
  if (!id) return null

  try {
    await db.todo.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
  } catch (err) {
    if (isPrismaRecordNotFoundError(err)) return null
    throw err
  }

  return { deleted: true, path }
}

function isPrismaRecordNotFoundError(err: unknown) {
  return (err as { code?: string } | null)?.code === "P2025"
}

function toVaultTodoNote(todo: TodoWithContext): VaultNote<TodoMeta> {
  const contact = todo.contact?.name ?? todo.communication?.contact?.name
  const deal =
    todo.deal?.propertyAddress ?? todo.communication?.deal?.propertyAddress
  return {
    path: prismaTodoPath(todo.id),
    meta: {
      type: "todo",
      category: todo.category,
      title: todo.title,
      status: mapPrismaStatusToVault(todo.status),
      priority: todo.priority,
      ...(todo.dueDate ? { due_date: todo.dueDate.toISOString() } : {}),
      ...(deal ? { deal } : {}),
      ...(contact ? { contact } : {}),
      ...(todo.communicationId
        ? { source_communication: `communication:${todo.communicationId}` }
        : {}),
      source: todo.agentActionId ? "ai_email_scrub" : "manual",
      created: todo.createdAt.toISOString(),
      updated: todo.updatedAt.toISOString(),
    },
    content:
      todo.body ??
      todo.communication?.subject ??
      (todo.agentActionId ? "Created from an approved AI suggestion." : ""),
  }
}

function mapPrismaStatusToVault(status: TodoStatus): TodoMeta["status"] {
  if (status === "done") return "done"
  if (status === "in_progress") return "in_progress"
  return "pending"
}

function mapVaultStatusToPrisma(status: TodoMeta["status"] | undefined) {
  if (!status) return undefined
  if (status === "done") return "done" as const
  if (status === "in_progress" || status === "in-progress") {
    return "in_progress" as const
  }
  return "pending" as const
}

function mapPriority(
  priority: TodoMeta["priority"] | undefined
): Priority | undefined {
  return priority
}

async function listPrismaTodoNotesWithContextsWhere(
  where: Prisma.TodoWhereInput
): Promise<PrismaTodoNotesWithContexts> {
  const todos = await db.todo.findMany({
    where,
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: TODO_CONTEXT_INCLUDE,
  })

  return {
    notes: todos.map(toVaultTodoNote),
    contexts: resolvePrismaTodoContexts(todos),
  }
}

function startOfNextDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}
