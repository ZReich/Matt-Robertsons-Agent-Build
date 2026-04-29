import { randomUUID } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import { bindMarkTodoDoneActions } from "./scrub"
import { loadOpenTodoCandidates, runHeuristicLinker } from "./scrub-linker"
import { PROMPT_VERSION } from "./scrub-types"

export const OUTBOUND_TODO_RECONCILIATION_MAX_LIMIT = 25
const DEFAULT_LIMIT = 10

export type OutboundTodoReconciliationInput = {
  mode: "dry-run" | "write"
  runId?: string
  limit?: number
  cursor?: string
}

export type OutboundTodoReconciliationResult = {
  mode: "dry-run" | "write"
  runId: string | null
  scannedCommunications: number
  candidateCount: number
  createdActionCount: number
  duplicateSuppressedCount: number
  nextCursor: string | null
  samples: Array<{
    communicationId: string
    todoId: string
    todoTitle: string
    contactId: string | null
    dealId: string | null
  }>
}

type OutboundCommunication = {
  id: string
  subject: string | null
  body: string | null
  date: Date
  metadata: unknown
  conversationId: string | null
  contactId: string | null
  dealId: string | null
  direction: "outbound" | null
}

export function validateReconciliationInput(
  input: OutboundTodoReconciliationInput
): Required<Omit<OutboundTodoReconciliationInput, "runId" | "cursor">> &
  Pick<OutboundTodoReconciliationInput, "runId" | "cursor"> {
  const limit = input.limit ?? DEFAULT_LIMIT
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ReconciliationInputError("limit must be a positive integer")
  }
  if (limit > OUTBOUND_TODO_RECONCILIATION_MAX_LIMIT) {
    throw new ReconciliationInputError(
      `limit must be <= ${OUTBOUND_TODO_RECONCILIATION_MAX_LIMIT}`
    )
  }
  if (input.mode === "write" && !input.runId?.trim()) {
    throw new ReconciliationInputError("runId is required for write mode")
  }
  if (input.mode === "write" && input.limit === undefined) {
    throw new ReconciliationInputError("limit is required for write mode")
  }
  if (input.runId && !/^[A-Za-z0-9_.:-]{1,100}$/.test(input.runId)) {
    throw new ReconciliationInputError("runId is invalid")
  }
  if (input.cursor && !/^[A-Za-z0-9_-]{1,128}$/.test(input.cursor)) {
    throw new ReconciliationInputError("cursor is invalid")
  }
  return {
    mode: input.mode,
    runId: input.runId,
    limit,
    cursor: input.cursor,
  }
}

export class ReconciliationInputError extends Error {
  status = 400
}

export async function reconcileOpenTodosFromOutbound(
  input: OutboundTodoReconciliationInput
): Promise<OutboundTodoReconciliationResult> {
  const options = validateReconciliationInput(input)
  const runId =
    options.runId ?? (options.mode === "dry-run" ? randomUUID() : undefined)
  if (options.mode === "write") {
    await requirePriorReconciliationDryRun({
      runId: runId!,
      limit: options.limit,
      cursor: options.cursor,
    })
  }
  const rows = await loadOutboundCommunications(options.limit, options.cursor)
  const nextCursor =
    rows.length > options.limit ? (rows[options.limit - 1]?.id ?? null) : null
  const communications = rows.slice(0, options.limit)
  const samples: OutboundTodoReconciliationResult["samples"] = []
  let candidateCount = 0
  let createdActionCount = 0
  let duplicateSuppressedCount = 0

  for (const comm of communications) {
    const matches = await runHeuristicLinker(comm)
    const openTodos = await loadOpenTodoCandidates(comm, matches)
    const actions = bindMarkTodoDoneActions(
      openTodos.map((todo) => ({
        actionType: "mark-todo-done" as const,
        summary: `Review outbound evidence for todo: ${todo.title}`,
        payload: {
          todoId: todo.id,
          reason: `Outbound communication ${comm.id} may show this todo was handled.`,
        },
      })),
      openTodos,
      {
        communicationId: comm.id,
        communicationDate: comm.date,
        direction: comm.direction,
        hasThreadOutboundEvidence: false,
      }
    )
    candidateCount += actions.length
    for (const action of actions) {
      const todoId =
        typeof action.payload.todoId === "string" ? action.payload.todoId : ""
      const todo = openTodos.find((candidate) => candidate.id === todoId)
      if (todo && samples.length < 10) {
        samples.push({
          communicationId: comm.id,
          todoId: todo.id,
          todoTitle: todo.title,
          contactId: todo.contactId,
          dealId: todo.dealId,
        })
      }
      if (options.mode === "dry-run") continue
      const created = await createPendingMarkTodoDoneAction({
        communicationId: comm.id,
        runId: runId!,
        action,
      })
      if (created) {
        createdActionCount += 1
      } else {
        duplicateSuppressedCount += 1
      }
    }
  }

  if (options.mode === "dry-run") {
    await rememberReconciliationDryRun({
      runId: runId!,
      limit: options.limit,
      cursor: options.cursor,
      candidateCount,
    })
  }

  return {
    mode: options.mode,
    runId: runId ?? null,
    scannedCommunications: communications.length,
    candidateCount,
    createdActionCount,
    duplicateSuppressedCount,
    nextCursor,
    samples,
  }
}

async function loadOutboundCommunications(limit: number, cursor?: string) {
  return db.communication.findMany({
    where: {
      channel: "email",
      direction: "outbound",
      archivedAt: null,
      id: cursor ? { gt: cursor } : undefined,
    },
    orderBy: { id: "asc" },
    take: limit + 1,
    select: {
      id: true,
      subject: true,
      body: true,
      date: true,
      metadata: true,
      conversationId: true,
      contactId: true,
      dealId: true,
      direction: true,
    },
  }) as Promise<OutboundCommunication[]>
}

async function createPendingMarkTodoDoneAction({
  communicationId,
  runId,
  action,
}: {
  communicationId: string
  runId: string
  action: ReturnType<typeof bindMarkTodoDoneActions>[number]
}): Promise<boolean> {
  const todoId =
    typeof action.payload.todoId === "string" ? action.payload.todoId : ""
  const targetEntity = `todo:${todoId}`
  const existing = await db.agentAction.findFirst({
    where: {
      actionType: "mark-todo-done",
      status: "pending",
      targetEntity,
    },
    select: { id: true },
  })
  if (existing) return false

  try {
    await db.agentAction.create({
      data: {
        actionType: "mark-todo-done",
        tier: "approve",
        status: "pending",
        summary: action.summary,
        sourceCommunicationId: communicationId,
        promptVersion: PROMPT_VERSION,
        targetEntity,
        payload: {
          ...action.payload,
          reconciliationRunId: runId,
          source: "outbound-todo-reconciliation",
        } as Prisma.InputJsonValue,
      },
    })
    return true
  } catch (error) {
    if (isUniqueConflict(error)) return false
    throw error
  }
}

async function rememberReconciliationDryRun(input: {
  runId: string
  limit: number
  cursor?: string
  candidateCount: number
}) {
  await db.systemState.upsert({
    where: { key: reconciliationDryRunKey(input.runId) },
    create: {
      key: reconciliationDryRunKey(input.runId),
      value: {
        runId: input.runId,
        limit: input.limit,
        cursor: input.cursor ?? null,
        candidateCount: input.candidateCount,
        at: new Date().toISOString(),
      },
    },
    update: {
      value: {
        runId: input.runId,
        limit: input.limit,
        cursor: input.cursor ?? null,
        candidateCount: input.candidateCount,
        at: new Date().toISOString(),
      },
    },
  })
}

async function requirePriorReconciliationDryRun(input: {
  runId: string
  limit: number
  cursor?: string
}) {
  const row = await db.systemState.findUnique({
    where: { key: reconciliationDryRunKey(input.runId) },
  })
  if (!row || !isDryRunValue(row.value)) {
    throw new ReconciliationInputError("dry run required before write")
  }
  if (
    row.value.limit !== input.limit ||
    (row.value.cursor ?? null) !== (input.cursor ?? null)
  ) {
    throw new ReconciliationInputError("write payload must match dry run")
  }
}

function reconciliationDryRunKey(runId: string): string {
  return `outbound-todo-reconciliation-dry-run:${runId}`
}

function isDryRunValue(value: unknown): value is {
  runId: string
  limit: number
  cursor: string | null
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "runId" in value &&
    "limit" in value &&
    "cursor" in value &&
    typeof (value as { runId?: unknown }).runId === "string" &&
    typeof (value as { limit?: unknown }).limit === "number" &&
    ((value as { cursor?: unknown }).cursor === null ||
      typeof (value as { cursor?: unknown }).cursor === "string")
  )
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2002" ||
      (error as { code?: string }).code === "23505")
  )
}
