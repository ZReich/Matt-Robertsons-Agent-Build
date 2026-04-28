import { describe, expect, it } from "vitest"

import { ScrubValidationError, validateScrubToolInput } from "./scrub-validator"

const baseScrub = {
  summary: "Tenant asked for a tour next week.",
  topicTags: ["showing-scheduling"],
  urgency: "soon",
  replyRequired: true,
  sentiment: "neutral",
  linkedContactCandidates: [
    { contactId: "contact-1", confidence: 0.92, reason: "Sender match" },
  ],
  linkedDealCandidates: [],
  suggestedActions: [],
}

describe("validateScrubToolInput", () => {
  it("accepts a valid scrub with a create-agent-memory action", () => {
    const result = validateScrubToolInput({
      ...baseScrub,
      suggestedActions: [
        {
          actionType: "create-agent-memory",
          summary: "Remember tenant prefers morning tours",
          payload: {
            memoryType: "preference",
            title: "Morning tour preference",
            content: "This contact prefers morning property tours.",
            contactId: "contact-1",
            priority: "medium",
          },
        },
      ],
    })

    expect(result.suggestedActions).toHaveLength(1)
    expect(result.suggestedActions[0]?.actionType).toBe("create-agent-memory")
    expect(result.droppedActions).toBe(0)
  })

  it("accepts a valid mark-todo-done action", () => {
    const result = validateScrubToolInput({
      ...baseScrub,
      suggestedActions: [
        {
          actionType: "mark-todo-done",
          summary: "Mark LOI todo done",
          payload: {
            todoId: "todo-123",
            reason: "Outbound email says the LOI was attached.",
          },
        },
      ],
    })

    expect(result.suggestedActions).toEqual([
      {
        actionType: "mark-todo-done",
        summary: "Mark LOI todo done",
        payload: {
          todoId: "todo-123",
          reason: "Outbound email says the LOI was attached.",
        },
      },
    ])
  })

  it("drops invalid mark-todo-done actions in relaxed mode", () => {
    const result = validateScrubToolInput(
      {
        ...baseScrub,
        suggestedActions: [
          {
            actionType: "mark-todo-done",
            summary: "Missing todo id",
            payload: {
              todoId: "",
              reason: "Outbound email says it was sent.",
            },
          },
          {
            actionType: "create-todo",
            summary: "Call Sarah",
            payload: {
              title: "Call Sarah",
              priority: "medium",
            },
          },
        ],
      },
      { mode: "relaxed" }
    )

    expect(result.droppedActions).toBe(1)
    expect(result.suggestedActions).toHaveLength(1)
    expect(result.suggestedActions[0]?.actionType).toBe("create-todo")
  })

  it("rejects more than five suggested actions (outer-shape)", () => {
    let caught: unknown
    try {
      validateScrubToolInput({
        ...baseScrub,
        suggestedActions: Array.from({ length: 6 }, (_, i) => ({
          actionType: "create-todo",
          summary: `Todo ${i}`,
          payload: { title: `Todo ${i}`, priority: "medium" },
        })),
      })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScrubValidationError)
    expect((caught as ScrubValidationError).kind).toBe("outer-shape")
  })

  it("strict mode: a bad per-action payload fails the entire row", () => {
    let caught: unknown
    try {
      validateScrubToolInput(
        {
          ...baseScrub,
          suggestedActions: [
            {
              actionType: "move-deal-stage",
              summary: "bad action",
              payload: { fromStage: "offer", toStage: "under_contract" }, // missing dealId + reason
            },
          ],
        },
        { mode: "strict" }
      )
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScrubValidationError)
    expect((caught as ScrubValidationError).kind).toBe("per-action")
  })

  it("relaxed mode: a bad per-action payload is DROPPED but the scrub still commits with the good actions", () => {
    const result = validateScrubToolInput(
      {
        ...baseScrub,
        suggestedActions: [
          {
            actionType: "create-todo",
            summary: "Valid todo",
            payload: { title: "Call back", priority: "high" },
          },
          {
            actionType: "move-deal-stage",
            summary: "bad action",
            payload: { fromStage: "offer", toStage: "under_contract" }, // missing required fields
          },
          {
            actionType: "create-agent-memory",
            summary: "another valid",
            payload: {
              memoryType: "client_note",
              title: "Note",
              content: "x",
            },
          },
        ],
      },
      { mode: "relaxed" }
    )

    expect(result.suggestedActions).toHaveLength(2)
    expect(result.droppedActions).toBe(1)
    expect(result.suggestedActions.map((a) => a.actionType)).toEqual([
      "create-todo",
      "create-agent-memory",
    ])
  })
})
