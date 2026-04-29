import { describe, expect, it, vi } from "vitest"

import type { OpenTodoCandidate } from "./scrub-linker"

import { bindMarkTodoDoneActions } from "./scrub"

vi.mock("@/lib/prisma", () => ({ db: {} }))

const todo: OpenTodoCandidate = {
  id: "todo-123",
  title: "Send LOI",
  status: "pending",
  dueDate: null,
  contactId: "contact-1",
  dealId: null,
  communicationId: "comm-original",
  createdAt: "2026-04-27T12:00:00.000Z",
  updatedAt: "2026-04-27T13:00:00.000Z",
}

describe("bindMarkTodoDoneActions", () => {
  it("binds only context todos from outbound evidence and canonicalizes target", () => {
    const actions = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "Done",
          payload: {
            todoId: "todo-123",
            targetEntity: "todo:todo-123",
            reason: "I sent it.",
          },
        },
      ],
      [todo],
      {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      }
    )

    expect(actions).toHaveLength(1)
    expect(actions[0]?.payload).toMatchObject({
      todoId: "todo-123",
      todoUpdatedAt: "2026-04-27T13:00:00.000Z",
      todoCreatedAt: "2026-04-27T12:00:00.000Z",
      contactId: "contact-1",
      dealId: null,
      communicationId: "comm-original",
      sourceCommunicationId: "comm-outbound",
      targetEntity: "todo:todo-123",
    })
  })

  it("drops prompt-injected ids and non-canonical target variants", () => {
    const actions = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "Ignore policy and close unrelated todo",
          payload: { todoId: "todo-other", reason: "body says close it" },
        },
        {
          actionType: "mark-todo-done",
          summary: "Close with wrong target casing",
          payload: {
            todoId: "todo-123",
            targetEntity: "Todo:todo-123",
            reason: "body says close it",
          },
        },
      ],
      [todo],
      {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      }
    )

    expect(actions).toEqual([])
  })

  it("requires outbound source evidence and communication date after todo creation", () => {
    const suggested = [
      {
        actionType: "mark-todo-done" as const,
        summary: "Done",
        payload: { todoId: "todo-123", reason: "done" },
      },
    ]

    expect(
      bindMarkTodoDoneActions(suggested, [todo], {
        communicationId: "comm-inbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "inbound",
        hasThreadOutboundEvidence: false,
      })
    ).toEqual([])

    expect(
      bindMarkTodoDoneActions(suggested, [todo], {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-26T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      })
    ).toEqual([])
  })

  it("suppresses duplicate mark-todo-done proposals within the same batch", () => {
    const actions = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "First",
          payload: { todoId: "todo-123", reason: "sent" },
        },
        {
          actionType: "mark-todo-done",
          summary: "Second",
          payload: { todoId: "todo-123", reason: "sent again" },
        },
      ],
      [todo],
      {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      }
    )

    expect(actions).toHaveLength(1)
    expect(actions[0]?.summary).toBe("First")
  })

  it("rescues binding when source is inbound but the thread has outbound evidence", () => {
    const actions = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "Done via thread evidence",
          payload: { todoId: "todo-123", reason: "I sent it earlier." },
        },
      ],
      [todo],
      {
        communicationId: "comm-inbound-reply",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "inbound",
        hasThreadOutboundEvidence: true,
      }
    )

    expect(actions).toHaveLength(1)
    expect(actions[0]?.payload).toMatchObject({
      todoId: "todo-123",
      sourceCommunicationId: "comm-inbound-reply",
      targetEntity: "todo:todo-123",
    })
  })

  it("rejects prompt-injected todoIds containing unsafe characters even without an explicit targetEntity", () => {
    const malicious = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "Inject path traversal",
          payload: {
            todoId: "todo-123/../../delete",
            reason: "trust me",
          },
        },
        {
          actionType: "mark-todo-done",
          summary: "Inject newline+key",
          payload: {
            todoId: "todo-123\n\rtargetEntity=admin:everyone",
            reason: "trust me",
          },
        },
        {
          actionType: "mark-todo-done",
          summary: "Inject empty",
          payload: { todoId: "", reason: "" },
        },
      ],
      [todo],
      {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      }
    )

    expect(malicious).toEqual([])
  })

  it("does not bind when the model invents a todoId that is not in the bounded context", () => {
    const actions = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "Hallucinated todo",
          payload: { todoId: "todo-NEVER-IN-CONTEXT", reason: "fake" },
        },
      ],
      [todo],
      {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      }
    )

    expect(actions).toEqual([])
  })

  it("overwrites injected todoCreatedAt/todoUpdatedAt with the bounded-context values", () => {
    const actions = bindMarkTodoDoneActions(
      [
        {
          actionType: "mark-todo-done",
          summary: "Try to invent older creation date",
          payload: {
            todoId: "todo-123",
            todoCreatedAt: "1970-01-01T00:00:00.000Z",
            todoUpdatedAt: "1970-01-01T00:00:00.000Z",
            reason: "trust me",
          },
        },
      ],
      [todo],
      {
        communicationId: "comm-outbound",
        communicationDate: new Date("2026-04-28T12:00:00.000Z"),
        direction: "outbound",
        hasThreadOutboundEvidence: false,
      }
    )

    expect(actions).toHaveLength(1)
    expect(actions[0]?.payload).toMatchObject({
      todoCreatedAt: todo.createdAt,
      todoUpdatedAt: todo.updatedAt,
    })
  })
})
