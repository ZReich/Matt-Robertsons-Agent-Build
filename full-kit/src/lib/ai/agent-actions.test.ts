import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  AgentActionReviewError,
  approveAgentAction,
  rejectAgentAction,
  snoozeAgentAction,
} from "./agent-actions"

vi.mock("@/lib/prisma", () => ({
  db: {
    agentAction: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    aiFeedback: { create: vi.fn() },
    communication: { findUnique: vi.fn() },
    todo: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    todoReminderPolicy: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

const action = {
  id: "action-1",
  actionType: "create-todo",
  tier: "approve",
  status: "pending",
  summary: "Follow up with lead",
  payload: {
    title: "Follow up with lead",
    priority: "high",
    contactId: "contact-1",
    propertyKey: "303 N Broadway",
  },
  targetEntity: null,
  sourceCommunicationId: "comm-1",
  promptVersion: "v1",
  feedback: null,
  duplicateOfActionId: null,
  dedupedToTodoId: null,
  communicationId: null,
  createdAt: new Date("2026-04-27T12:00:00.000Z"),
  updatedAt: new Date("2026-04-27T12:00:00.000Z"),
  executedAt: null,
} as const

describe("agent action review workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
      fn(db)
    )
    ;(db.agentAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      action
    )
    ;(
      db.communication.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: "comm-1", archivedAt: null })
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { archived_at: null },
    ])
    ;(db.todo.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "todo-1",
    })
  })

  it("approves a create-todo action by creating one todo and executing the action", async () => {
    await expect(
      approveAgentAction({ id: "action-1", reviewer: "reviewer@example.com" })
    ).resolves.toEqual({
      status: "executed",
      todoId: "todo-1",
      actionId: "action-1",
    })

    expect(db.todo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Follow up with lead",
        priority: "high",
        contactId: "contact-1",
        communicationId: "comm-1",
        agentActionId: "action-1",
        dedupeKey: "ai-todo:lead-followup:contact:contact-1:303-n-broadway",
        createdBy: "reviewer@example.com",
      }),
    })
    expect(db.agentAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: { status: "executed", executedAt: expect.any(Date) },
    })
  })

  it("turns a dedupe unique conflict into a rejected duplicate with audit pointers", async () => {
    ;(db.todo.create as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "P2002",
    })
    ;(db.$queryRaw as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ archived_at: null }])
      .mockResolvedValueOnce([
        { id: "todo-winner", agent_action_id: "action-winner" },
      ])

    await expect(
      approveAgentAction({ id: "action-1", reviewer: "reviewer@example.com" })
    ).resolves.toEqual({
      status: "rejected_duplicate",
      todoId: "todo-winner",
      duplicateOfActionId: "action-winner",
      actionId: "action-1",
    })

    expect(db.agentAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: {
        status: "rejected",
        feedback: "duplicate",
        duplicateOfActionId: "action-winner",
        dedupedToTodoId: "todo-winner",
      },
    })
  })

  it("returns the existing todo when an executed action is approved again", async () => {
    ;(db.agentAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...action,
      status: "executed",
    })
    ;(db.todo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "todo-1",
    })

    await expect(
      approveAgentAction({ id: "action-1", reviewer: "reviewer@example.com" })
    ).resolves.toEqual({
      status: "executed",
      todoId: "todo-1",
      actionId: "action-1",
    })

    expect(db.todo.create).not.toHaveBeenCalled()
  })

  it("returns rejected_duplicate when a losing duplicate action is approved again", async () => {
    ;(db.agentAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...action,
      status: "rejected",
      feedback: "duplicate",
      duplicateOfActionId: "action-winner",
      dedupedToTodoId: "todo-winner",
    })

    await expect(
      approveAgentAction({ id: "action-1", reviewer: "reviewer@example.com" })
    ).resolves.toEqual({
      status: "rejected_duplicate",
      todoId: "todo-winner",
      duplicateOfActionId: "action-winner",
      actionId: "action-1",
    })

    expect(db.todo.create).not.toHaveBeenCalled()
  })

  it("rejects stale actions when the source communication is archived", async () => {
    ;(db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { archived_at: new Date() },
    ])

    await expect(
      approveAgentAction({ id: "action-1", reviewer: "reviewer@example.com" })
    ).rejects.toMatchObject({
      code: "stale_action",
      status: 409,
    })

    expect(db.todo.create).not.toHaveBeenCalled()
    expect(db.agentAction.updateMany).toHaveBeenCalledWith({
      where: { id: "action-1", status: "pending" },
      data: { status: "rejected", feedback: "stale" },
    })
  })

  it("preserves explicit rejection feedback and records review feedback", async () => {
    await expect(
      rejectAgentAction({
        id: "action-1",
        reviewer: "reviewer@example.com",
        feedback: "not useful",
      })
    ).resolves.toEqual({ status: "rejected", actionId: "action-1" })

    expect(db.agentAction.update).toHaveBeenCalledWith({
      where: { id: "action-1" },
      data: { status: "rejected", feedback: "not useful" },
    })
    expect(db.aiFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: "agent_action",
        sourceId: "action-1",
        correctedAction: "reject",
        reason: "not useful",
      }),
    })
  })

  it("refuses to snooze non-create-todo actions in V1", async () => {
    ;(db.agentAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...action,
      actionType: "move-deal-stage",
    })

    await expect(
      snoozeAgentAction({
        id: "action-1",
        snoozedUntil: new Date("2026-04-28T12:00:00.000Z"),
        reviewer: "reviewer@example.com",
      })
    ).rejects.toBeInstanceOf(AgentActionReviewError)

    expect(db.todoReminderPolicy.create).not.toHaveBeenCalled()
  })

  it("records reviewer audit when snoozing an action", async () => {
    await expect(
      snoozeAgentAction({
        id: "action-1",
        snoozedUntil: new Date("2026-04-28T12:00:00.000Z"),
        reviewer: "reviewer@example.com",
      })
    ).resolves.toEqual({
      status: "snoozed",
      actionId: "action-1",
      snoozedUntil: "2026-04-28T12:00:00.000Z",
    })

    expect(db.todoReminderPolicy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentActionId: "action-1",
        state: "snoozed",
        metadata: {
          actionType: "create-todo",
          reviewer: "reviewer@example.com",
        },
      }),
    })
    expect(db.aiFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        correctedAction: "snooze",
        createdBy: "reviewer@example.com",
      }),
    })
  })

  it("refreshes an existing snooze instead of failing on a unique conflict", async () => {
    ;(
      db.todoReminderPolicy.create as ReturnType<typeof vi.fn>
    ).mockRejectedValue({ code: "P2002" })

    await expect(
      snoozeAgentAction({
        id: "action-1",
        snoozedUntil: new Date("2026-04-28T12:00:00.000Z"),
        reviewer: "reviewer@example.com",
      })
    ).resolves.toMatchObject({ status: "snoozed", actionId: "action-1" })

    expect(db.todoReminderPolicy.updateMany).toHaveBeenCalledWith({
      where: { agentActionId: "action-1", state: "snoozed" },
      data: expect.objectContaining({
        snoozedUntil: new Date("2026-04-28T12:00:00.000Z"),
        nextReminderAt: new Date("2026-04-28T12:00:00.000Z"),
      }),
    })
  })
})
