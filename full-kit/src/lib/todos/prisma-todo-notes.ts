import type { TodoMeta, VaultNote } from "@/lib/vault"
import type { Priority, Prisma, TodoStatus } from "@prisma/client"

import { db } from "@/lib/prisma"
import { resolvePrismaTodoContexts } from "@/lib/vault/resolve-context"

import { getPrismaTodoId, prismaTodoPath } from "./paths"

export {
  PRISMA_TODO_PATH_PREFIX,
  getPrismaTodoId,
  isPrismaTodoPath,
} from "./paths"

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
  agentAction: {
    select: {
      id: true,
      summary: true,
      actionType: true,
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

/**
 * Lookup map of `propertyId` → `{ id, address }`. Built from a single
 * batched `db.property.findMany` over the property IDs that appear in the
 * `metadata.propertyId` field of the visible Todos. Empty when no Todo
 * carries a property reference, in which case no DB query is issued.
 */
type PropertyLookup = Map<string, { id: string; address: string }>

async function loadPropertyLookup(
  todos: TodoWithContext[]
): Promise<PropertyLookup> {
  const propertyIds = new Set<string>()
  for (const todo of todos) {
    const meta = asMetadataRecord(todo.metadata)
    const id = typeof meta.propertyId === "string" ? meta.propertyId : null
    if (id) propertyIds.add(id)
  }
  if (propertyIds.size === 0) return new Map()

  const rows = await db.property.findMany({
    where: { id: { in: Array.from(propertyIds) } },
    select: { id: true, address: true },
  })
  return new Map(rows.map((row) => [row.id, row]))
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
    const propertyLookup = await loadPropertyLookup([todo])
    return toVaultTodoNote(todo, propertyLookup)
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

function toVaultTodoNote(
  todo: TodoWithContext,
  propertyLookup: PropertyLookup
): VaultNote<TodoMeta> {
  const contact = todo.contact?.name ?? todo.communication?.contact?.name
  const deal =
    todo.deal?.propertyAddress ?? todo.communication?.deal?.propertyAddress
  // metadata.actionType is the marker the Todos UI uses to render inline
  // approve/reject buttons (auto-reply → Send draft, delete-* → Confirm
  // delete, etc.). Set by the auto-promotion sweep at
  // src/lib/ai/agent-action-auto-promotion.ts.
  const meta = asMetadataRecord(todo.metadata)
  const agentActionType =
    typeof meta.actionType === "string" ? meta.actionType : undefined
  // matchScore + matchSignals are written by the auto-promotion sweep
  // (src/lib/ai/agent-action-auto-promotion.ts) when it links a Todo to
  // a contact/deal heuristically. Surface them so the card can render a
  // "Weak match" chip when the confidence is low.
  const matchScore =
    typeof meta.matchScore === "number" ? meta.matchScore : undefined
  const matchSignals = Array.isArray(meta.matchSignals)
    ? (meta.matchSignals.filter((s) => typeof s === "string") as string[])
    : undefined
  // metadata.propertyId is written by the auto-promotion sweep when the
  // entity matcher links a Todo to a Property. Property has no FK on Todo
  // today, so we resolve it server-side from the batched lookup map.
  const propertyId =
    typeof meta.propertyId === "string" ? meta.propertyId : undefined
  const property = propertyId ? propertyLookup.get(propertyId) : undefined
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
      ...(todo.agentAction?.summary
        ? { ai_rationale: todo.agentAction.summary }
        : {}),
      ...(agentActionType ? { agent_action_type: agentActionType } : {}),
      ...(todo.agentActionId ? { agent_action_id: todo.agentActionId } : {}),
      ...(matchScore !== undefined ? { match_score: matchScore } : {}),
      ...(matchSignals && matchSignals.length > 0
        ? { match_signals: matchSignals }
        : {}),
      ...(property ? { property } : {}),
      created: todo.createdAt.toISOString(),
      updated: todo.updatedAt.toISOString(),
    },
    content:
      todo.body ??
      todo.communication?.subject ??
      (todo.agentActionId ? "Created from an approved AI suggestion." : ""),
  }
}

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
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
    // No DB-side priority sort: Postgres enum sort follows declared order
    // (low → medium → high → urgent), opposite of what callers want.
    // Every consumer (TodoList, dashboard widgets, GET /api/vault/todos)
    // re-sorts in JS using PRIORITY_ORDER, so the DB-side ordering only
    // controls tie-breaking on dueDate.
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: TODO_CONTEXT_INCLUDE,
  })

  const propertyLookup = await loadPropertyLookup(todos)

  return {
    notes: todos.map((todo) => toVaultTodoNote(todo, propertyLookup)),
    contexts: resolvePrismaTodoContexts(todos),
  }
}

function startOfNextDay(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
}
