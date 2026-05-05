import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  ACTION_TYPE_TODO_BEHAVIOR,
  autoPromoteAgentActionsToTodos,
} from "./agent-action-auto-promotion"

vi.mock("@/lib/prisma", () => ({
  db: {
    agentAction: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    todo: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    communication: {
      findUnique: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    deal: {
      findFirst: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const NOW = new Date("2026-05-04T12:00:00.000Z")
const FRESH = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000)
const STALE = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000)

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: `action-${Math.random().toString(36).slice(2, 8)}`,
    actionType: "auto-reply",
    tier: "approve",
    status: "pending",
    summary: "Reply to lead inquiry about 303 N Broadway",
    payload: {
      subject: "Re: Inquiry on 303 N Broadway",
      draftBody: "Hi, attached is the OM…",
    },
    targetEntity: null,
    sourceCommunicationId: "comm-1",
    promptVersion: "v1",
    feedback: null,
    duplicateOfActionId: null,
    dedupedToTodoId: null,
    executedAt: null,
    createdAt: FRESH,
    updatedAt: FRESH,
    sourceCommunication: {
      id: "comm-1",
      subject: "Re: Inquiry on 303 N Broadway",
      body: "Hi Matt, I'm interested in your listing.",
      date: FRESH,
      contactId: "contact-1",
      dealId: null,
      contact: { id: "contact-1", name: "Sarah Chen", email: "sarah@example.com" },
    },
    ...overrides,
  } as const
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
    fn(db)
  )
  ;(db.todo.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "todo-1",
  })
  ;(db.todo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.communication.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    contactId: "contact-1",
    dealId: null,
  })
  ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.deal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.property.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
})

describe("autoPromoteAgentActionsToTodos", () => {
  it("promotes a fresh approval-todo action and leaves it pending", async () => {
    const action = makeAction()
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      action,
    ])

    const result = await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(result).toEqual({
      scanned: 1,
      promoted: 1,
      expired: 0,
      skipped: 0,
      errors: [],
    })
    expect(db.todo.create).toHaveBeenCalledTimes(1)
    const createCall = (db.todo.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0]
    expect(createCall.data.title).toContain("Review draft reply")
    expect(createCall.data.agentActionId).toBe(action.id)
    expect(createCall.data.contactId).toBe("contact-1")
    expect(createCall.data.metadata.actionType).toBe("auto-reply")
    expect(createCall.data.metadata.policy).toBe("approval-todo")
    // approval-todo leaves the AgentAction in pending so the inline button
    // can drive the existing approve handler.
    expect(db.agentAction.update).not.toHaveBeenCalled()
  })

  it("transitions stale pending actions to expired without creating todos", async () => {
    const stale = makeAction({ createdAt: STALE })
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      stale,
    ])

    const result = await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(result).toEqual({
      scanned: 1,
      promoted: 0,
      expired: 1,
      skipped: 0,
      errors: [],
    })
    expect(db.todo.create).not.toHaveBeenCalled()
    expect(db.agentAction.update).toHaveBeenCalledWith({
      where: { id: stale.id },
      data: { status: "expired", feedback: "auto-expired-by-sweep" },
    })
  })

  it("skips action types marked as 'skip' (cache + already-handled types)", async () => {
    const cache = makeAction({ actionType: "summarize-thread" })
    const alreadyHandled = makeAction({ actionType: "create-todo" })
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      cache,
      alreadyHandled,
    ])

    const result = await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(result.scanned).toBe(2)
    expect(result.skipped).toBe(2)
    expect(result.promoted).toBe(0)
    expect(db.todo.create).not.toHaveBeenCalled()
  })

  it("skips unknown action types with a console warning", async () => {
    const unknown = makeAction({ actionType: "frobnicate-the-quux" })
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      unknown,
    ])
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(result.skipped).toBe(1)
    expect(result.promoted).toBe(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("auto-todo policy approves the AgentAction after creating the Todo", async () => {
    const action = makeAction({
      actionType: "set-client-type",
      payload: { clientType: "past_client" },
    })
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      action,
    ])

    await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(db.todo.create).toHaveBeenCalledTimes(1)
    expect(db.agentAction.update).toHaveBeenCalledWith({
      where: { id: action.id },
      data: { status: "approved", feedback: "auto-promoted-to-todo" },
    })
  })

  it("returns zero-promote in dryRun mode", async () => {
    const action = makeAction()
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      action,
    ])

    const result = await autoPromoteAgentActionsToTodos({
      now: NOW,
      dryRun: true,
    })

    expect(result.promoted).toBe(1)
    expect(db.todo.create).not.toHaveBeenCalled()
    expect(db.agentAction.update).not.toHaveBeenCalled()
  })

  it("does not double-promote when a Todo already exists for the action", async () => {
    const action = makeAction()
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      action,
    ])
    ;(db.todo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing-todo",
    })

    const result = await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(result.promoted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(db.todo.create).not.toHaveBeenCalled()
  })

  it("captures per-action errors without aborting the sweep", async () => {
    const a = makeAction({ id: "a" })
    const b = makeAction({ id: "b" })
    ;(db.agentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      a,
      b,
    ])
    ;(db.todo.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: "todo-a" })
      .mockRejectedValueOnce(new Error("DB exploded"))

    const result = await autoPromoteAgentActionsToTodos({ now: NOW })

    expect(result.scanned).toBe(2)
    expect(result.promoted).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].agentActionId).toBe("b")
    expect(result.errors[0].error).toContain("DB exploded")
  })
})

describe("ACTION_TYPE_TODO_BEHAVIOR policy map", () => {
  it("treats the existing auto-approval set as 'skip' to avoid double-handling", () => {
    expect(ACTION_TYPE_TODO_BEHAVIOR["create-todo"]).toBe("skip")
    expect(ACTION_TYPE_TODO_BEHAVIOR["mark-todo-done"]).toBe("skip")
    expect(ACTION_TYPE_TODO_BEHAVIOR["create-agent-memory"]).toBe("skip")
  })

  it("classifies destructive + outbound actions as approval-todo", () => {
    expect(ACTION_TYPE_TODO_BEHAVIOR["auto-reply"]).toBe("approval-todo")
    expect(ACTION_TYPE_TODO_BEHAVIOR["delete-contact"]).toBe("approval-todo")
    expect(ACTION_TYPE_TODO_BEHAVIOR["move-deal-stage"]).toBe("approval-todo")
  })
})
