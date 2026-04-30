import type { AgentAction, Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import {
  createDealFromAction,
  moveDealStageFromAction,
  updateDealFromAction,
} from "./agent-actions-deal"
import { AI_FEEDBACK_SOURCE_TYPES } from "./feedback-source-types"

export class AgentActionReviewError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "agent_action_error"
  ) {
    super(message)
  }
}

export type AgentActionReviewResult =
  | { status: "executed"; todoId: string; actionId: string }
  | {
      status: "rejected_duplicate"
      todoId: string
      duplicateOfActionId: string | null
      actionId: string
    }
  | { status: "rejected"; actionId: string }
  | { status: "snoozed"; actionId: string; snoozedUntil: string }

export async function approveAgentAction({
  id,
  reviewer,
}: {
  id: string
  reviewer: string
}): Promise<AgentActionReviewResult> {
  const action = await getAction(id)

  if (action.status === "executed") {
    const todo =
      action.actionType === "mark-todo-done"
        ? await db.todo.findUnique({
            where: {
              id: parseMarkTodoDonePayload(action, {
                requireEvidenceSnapshot: false,
              }).todoId,
            },
          })
        : await db.todo.findUnique({ where: { agentActionId: id } })
    if (!todo) {
      throw new AgentActionReviewError(
        "executed action has no linked todo",
        409,
        "missing_executed_entity"
      )
    }
    return { status: "executed", todoId: todo.id, actionId: id }
  }

  if (isRejectedDuplicate(action)) {
    return {
      status: "rejected_duplicate",
      todoId: action.dedupedToTodoId ?? "",
      duplicateOfActionId: action.duplicateOfActionId,
      actionId: id,
    }
  }

  if (action.status !== "pending") {
    throw new AgentActionReviewError(
      `cannot approve ${action.status} action`,
      409,
      "invalid_action_status"
    )
  }

  switch (action.actionType) {
    case "create-todo":
      return createTodoFromAction(action, reviewer)
    case "mark-todo-done":
      return markTodoDoneFromAction(action, reviewer)
    case "move-deal-stage":
      return moveDealStageFromAction(action, reviewer)
    case "update-deal":
      return updateDealFromAction(action, reviewer)
    case "create-deal":
      return createDealFromAction(action, reviewer)
    default:
      throw new AgentActionReviewError(
        `unsupported action type: ${action.actionType}`,
        400,
        "unsupported_action_type"
      )
  }
}

export async function rejectAgentAction({
  id,
  reviewer,
  feedback,
}: {
  id: string
  reviewer: string
  feedback?: string
}): Promise<AgentActionReviewResult> {
  const action = await getAction(id)
  if (action.status === "executed") {
    throw new AgentActionReviewError(
      "executed action cannot be rejected",
      409,
      "invalid_action_status"
    )
  }
  if (action.status === "rejected") {
    return { status: "rejected", actionId: id }
  }

  await db.$transaction(async (tx) => {
    await tx.agentAction.update({
      where: { id },
      data: { status: "rejected", feedback: feedback ?? "rejected" },
    })
    await createFeedback(tx, {
      action,
      reviewer,
      reason: feedback ?? "rejected",
      correctedAction: "reject",
    })
  })

  return { status: "rejected", actionId: id }
}

export async function snoozeAgentAction({
  id,
  snoozedUntil,
  reviewer,
}: {
  id: string
  snoozedUntil: Date
  reviewer: string
}): Promise<AgentActionReviewResult> {
  const action = await getAction(id)
  if (action.status !== "pending") {
    throw new AgentActionReviewError(
      `cannot snooze ${action.status} action`,
      409,
      "invalid_action_status"
    )
  }
  if (
    action.actionType !== "create-todo" &&
    action.actionType !== "mark-todo-done"
  ) {
    throw new AgentActionReviewError(
      "unsupported action type",
      400,
      "unsupported_action_type"
    )
  }

  try {
    await writeSnoozePolicy({ action, snoozedUntil, reviewer })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    await refreshSnoozePolicy({ action, snoozedUntil, reviewer })
  }

  return {
    status: "snoozed",
    actionId: id,
    snoozedUntil: snoozedUntil.toISOString(),
  }
}

async function markTodoDoneFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = parseMarkTodoDonePayload(action)

  const result = await db.$transaction(async (tx) => {
    const actionRows = await tx.$queryRaw<
      Array<{ status: string; target_entity: string | null }>
    >`
      SELECT "status"::text, "target_entity"
      FROM "agent_actions"
      WHERE "id" = ${action.id}
      LIMIT 1
      FOR UPDATE
    `
    const lockedAction = actionRows[0]
    if (!lockedAction) {
      return { kind: "missing_action" as const }
    }
    if (lockedAction.status === "executed") {
      return { kind: "already_handled" as const, todoId: payload.todoId }
    }
    if (lockedAction.status !== "pending") {
      return { kind: "invalid_status" as const, status: lockedAction.status }
    }
    if (lockedAction.target_entity !== `todo:${payload.todoId}`) {
      return { kind: "scope_mismatch" as const }
    }

    if (
      await isSourceCommunicationStaleForUpdate(
        tx,
        action.sourceCommunicationId
      )
    ) {
      return { kind: "stale" as const }
    }

    const rows = await tx.$queryRaw<
      Array<{
        id: string
        archived_at: Date | null
        status: string
        contact_id: string | null
        deal_id: string | null
        communication_id: string | null
        updated_at: Date
      }>
    >`
      SELECT "id", "archived_at", "status"::text, "contact_id", "deal_id",
             "communication_id", "updatedAt" AS updated_at
      FROM "todos"
      WHERE "id" = ${payload.todoId}
      LIMIT 1
      FOR UPDATE
    `
    const todo = rows[0]
    if (!todo || todo.archived_at !== null) {
      return { kind: "missing" as const }
    }
    if (todo.status !== "pending" && todo.status !== "in_progress") {
      return { kind: "not_open" as const }
    }
    if (
      todo.updated_at.toISOString() !== payload.todoUpdatedAt ||
      todo.contact_id !== payload.contactId ||
      todo.deal_id !== payload.dealId ||
      todo.communication_id !== payload.communicationId
    ) {
      return { kind: "scope_mismatch" as const }
    }

    await tx.todo.update({
      where: { id: payload.todoId },
      data: { status: "done" },
    })
    await tx.agentAction.update({
      where: { id: action.id },
      data: { status: "executed", executedAt: new Date() },
    })
    await tx.todoReminderPolicy.updateMany({
      where: {
        todoId: payload.todoId,
        state: {
          in: [
            "proposed",
            "active",
            "waiting_on_other",
            "snoozed",
            "due",
            "overdue",
          ],
        },
      },
      data: {
        state: "done",
        lastEvidenceAt: new Date(),
        policyReason: payload.reason,
      },
    })
    await createFeedback(tx, {
      action,
      reviewer,
      reason: payload.reason,
      correctedAction: "mark-todo-done",
    })
    return { kind: "done" as const, todoId: payload.todoId }
  })

  if (result.kind === "already_handled") {
    return { status: "executed", todoId: result.todoId, actionId: action.id }
  }
  if (result.kind === "stale") {
    await markActionStale(action.id)
    throw new AgentActionReviewError(
      "source communication is stale",
      409,
      "stale_action"
    )
  }
  if (result.kind === "missing_action") {
    throw new AgentActionReviewError("action not found", 404, "not_found")
  }
  if (result.kind === "invalid_status") {
    throw new AgentActionReviewError(
      `cannot approve ${result.status} action`,
      409,
      "invalid_action_status"
    )
  }
  if (result.kind === "missing") {
    throw new AgentActionReviewError("todo not found", 404, "todo_missing")
  }
  if (result.kind === "not_open") {
    throw new AgentActionReviewError(
      "todo is no longer open",
      409,
      "todo_not_open"
    )
  }
  if (result.kind === "scope_mismatch") {
    throw new AgentActionReviewError(
      "todo no longer matches action evidence",
      409,
      "todo_scope_mismatch"
    )
  }

  return { status: "executed", todoId: result.todoId, actionId: action.id }
}

async function createTodoFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = parseCreateTodoPayload(action)
  const dedupeKey = buildTodoDedupeKey(action, payload)

  try {
    const result = await db.$transaction(async (tx) => {
      if (
        await isSourceCommunicationStaleForUpdate(
          tx,
          action.sourceCommunicationId
        )
      ) {
        return { kind: "stale" as const }
      }

      const todo = await tx.todo.create({
        data: {
          title: payload.title,
          body: payload.body,
          priority: payload.priority,
          dueDate: payload.parsedDueDate
            ? new Date(payload.parsedDueDate)
            : undefined,
          contactId: payload.contactId,
          dealId: payload.dealId,
          communicationId: action.sourceCommunicationId,
          agentActionId: action.id,
          dedupeKey,
          createdBy: reviewer,
        },
      })
      await tx.agentAction.update({
        where: { id: action.id },
        data: { status: "executed", executedAt: new Date() },
      })
      await tx.todoReminderPolicy.updateMany({
        where: { agentActionId: action.id, state: "snoozed" },
        data: { state: "superseded" },
      })
      return { kind: "created" as const, todoId: todo.id }
    })
    if (result.kind === "stale") {
      await markActionStale(action.id)
      throw new AgentActionReviewError(
        "source communication is stale",
        409,
        "stale_action"
      )
    }
    return { status: "executed", todoId: result.todoId, actionId: action.id }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return markDuplicateAction(action, dedupeKey)
    }
    throw error
  }
}

async function markDuplicateAction(
  action: AgentAction,
  dedupeKey: string
): Promise<AgentActionReviewResult> {
  const existingTodo = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; agent_action_id: string | null }>
    >`
      SELECT "id", "agent_action_id"
      FROM "todos"
      WHERE "dedupe_key" = ${dedupeKey}
        AND "archived_at" IS NULL
        AND "status"::text <> 'done'
      LIMIT 1
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) return null

    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "rejected",
        feedback: "duplicate",
        duplicateOfActionId: row.agent_action_id,
        dedupedToTodoId: row.id,
      },
    })
    return { id: row.id, agentActionId: row.agent_action_id }
  })
  if (!existingTodo) {
    throw new AgentActionReviewError(
      "duplicate todo not found",
      409,
      "duplicate_target_missing"
    )
  }

  return {
    status: "rejected_duplicate",
    todoId: existingTodo.id,
    duplicateOfActionId: existingTodo.agentActionId,
    actionId: action.id,
  }
}

async function writeSnoozePolicy({
  action,
  snoozedUntil,
  reviewer,
}: {
  action: AgentAction
  snoozedUntil: Date
  reviewer: string
}) {
  await db.$transaction(async (tx) => {
    await tx.todoReminderPolicy.updateMany({
      where: { agentActionId: action.id, state: "snoozed" },
      data: { state: "superseded" },
    })
    await tx.todoReminderPolicy.create({
      data: snoozePolicyData(action, snoozedUntil, reviewer),
    })
    await createFeedback(tx, {
      action,
      reviewer,
      reason: `snoozed until ${snoozedUntil.toISOString()}`,
      correctedAction: "snooze",
    })
  })
}

async function refreshSnoozePolicy({
  action,
  snoozedUntil,
  reviewer,
}: {
  action: AgentAction
  snoozedUntil: Date
  reviewer: string
}) {
  await db.$transaction(async (tx) => {
    await tx.todoReminderPolicy.updateMany({
      where: { agentActionId: action.id, state: "snoozed" },
      data: {
        snoozedUntil,
        nextReminderAt: snoozedUntil,
        metadata: snoozePolicyData(action, snoozedUntil, reviewer).metadata,
      },
    })
    await createFeedback(tx, {
      action,
      reviewer,
      reason: `snoozed until ${snoozedUntil.toISOString()}`,
      correctedAction: "snooze",
    })
  })
}

function snoozePolicyData(
  action: AgentAction,
  snoozedUntil: Date,
  reviewer: string
): Prisma.TodoReminderPolicyCreateInput {
  return {
    agentActionId: action.id,
    communicationId: action.sourceCommunicationId,
    state: "snoozed",
    snoozedUntil,
    nextReminderAt: snoozedUntil,
    sourcePolicy: "agent-action-snooze-v1",
    dedupeKey: getPayloadDedupeKey(action) ?? undefined,
    metadata: { actionType: action.actionType, reviewer },
  }
}

async function isSourceCommunicationStaleForUpdate(
  tx: Prisma.TransactionClient,
  sourceCommunicationId: string | null
) {
  if (!sourceCommunicationId) return true

  const rows = await tx.$queryRaw<Array<{ archived_at: Date | null }>>`
    SELECT "archived_at"
    FROM "communications"
    WHERE "id" = ${sourceCommunicationId}
    FOR UPDATE
  `
  return rows.length !== 1 || rows[0].archived_at !== null
}

async function markActionStale(id: string) {
  await db.agentAction.updateMany({
    where: { id, status: "pending" },
    data: { status: "rejected", feedback: "stale" },
  })
}

function parseCreateTodoPayload(action: AgentAction): {
  title: string
  body?: string
  priority: "low" | "medium" | "high" | "urgent"
  parsedDueDate?: string
  contactId?: string
  dealId?: string
  actionKind?: string
  propertyKey?: string
} {
  const payload = asRecord(action.payload)
  const title = typeof payload.title === "string" ? payload.title.trim() : ""
  if (!title) {
    throw new AgentActionReviewError(
      "todo title is required",
      400,
      "invalid_payload"
    )
  }
  const priority =
    payload.priority === "low" ||
    payload.priority === "medium" ||
    payload.priority === "high" ||
    payload.priority === "urgent"
      ? payload.priority
      : "medium"

  return {
    title,
    body: typeof payload.body === "string" ? payload.body : undefined,
    priority,
    parsedDueDate:
      typeof payload.parsedDueDate === "string"
        ? payload.parsedDueDate
        : undefined,
    contactId:
      typeof payload.contactId === "string" ? payload.contactId : undefined,
    dealId: typeof payload.dealId === "string" ? payload.dealId : undefined,
    actionKind:
      typeof payload.actionKind === "string" ? payload.actionKind : undefined,
    propertyKey:
      typeof payload.propertyKey === "string" ? payload.propertyKey : undefined,
  }
}

function parseMarkTodoDonePayload(
  action: AgentAction,
  options: { requireEvidenceSnapshot?: boolean } = {}
): {
  todoId: string
  reason: string
  todoUpdatedAt: string
  contactId: string | null
  dealId: string | null
  communicationId: string | null
} {
  const payload = asRecord(action.payload)
  const todoId = typeof payload.todoId === "string" ? payload.todoId.trim() : ""
  if (!todoId) {
    throw new AgentActionReviewError(
      "todo id is required",
      400,
      "invalid_payload"
    )
  }
  const reason =
    typeof payload.reason === "string" && payload.reason.trim()
      ? payload.reason.trim()
      : action.summary
  const todoUpdatedAt =
    typeof payload.todoUpdatedAt === "string" ? payload.todoUpdatedAt : ""
  if (
    options.requireEvidenceSnapshot !== false &&
    (!todoUpdatedAt || Number.isNaN(Date.parse(todoUpdatedAt)))
  ) {
    throw new AgentActionReviewError(
      "todo evidence snapshot is required",
      400,
      "invalid_payload"
    )
  }
  return {
    todoId,
    reason,
    todoUpdatedAt: todoUpdatedAt ? new Date(todoUpdatedAt).toISOString() : "",
    contactId: typeof payload.contactId === "string" ? payload.contactId : null,
    dealId: typeof payload.dealId === "string" ? payload.dealId : null,
    communicationId:
      typeof payload.communicationId === "string"
        ? payload.communicationId
        : null,
  }
}

function buildTodoDedupeKey(
  action: AgentAction,
  payload: ReturnType<typeof parseCreateTodoPayload>
): string {
  const contactKey = payload.contactId
    ? `contact:${payload.contactId}`
    : `source:${action.sourceCommunicationId ?? action.id}`
  return [
    "ai-todo",
    normalizeKeyPart(payload.actionKind ?? "lead-followup"),
    normalizeKeyPart(contactKey),
    normalizeKeyPart(payload.propertyKey ?? "none"),
  ].join(":")
}

function getPayloadDedupeKey(action: AgentAction): string | null {
  try {
    return buildTodoDedupeKey(action, parseCreateTodoPayload(action))
  } catch {
    return null
  }
}

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-")
}

function isRejectedDuplicate(action: AgentAction) {
  return (
    action.status === "rejected" &&
    action.feedback === "duplicate" &&
    Boolean(action.duplicateOfActionId) &&
    Boolean(action.dedupedToTodoId)
  )
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2002" ||
      (error as { code?: string }).code === "23505")
  )
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

async function getAction(id: string) {
  const action = await db.agentAction.findUnique({ where: { id } })
  if (!action) {
    throw new AgentActionReviewError("action not found", 404, "not_found")
  }
  return action
}

async function createFeedback(
  tx: Prisma.TransactionClient,
  {
    action,
    reviewer,
    reason,
    correctedAction,
  }: {
    action: AgentAction
    reviewer: string
    reason: string
    correctedAction: string
  }
) {
  await tx.aiFeedback.create({
    data: {
      sourceType: AI_FEEDBACK_SOURCE_TYPES.agentAction,
      sourceId: action.id,
      promptVersion: action.promptVersion,
      predictedAction: action.actionType,
      correctedAction,
      reason,
      createdBy: reviewer,
    },
  })
}
