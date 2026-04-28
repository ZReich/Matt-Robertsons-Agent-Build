import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { getAiSuggestionState } from "./suggestions"

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: { findMany: vi.fn() },
    agentAction: { findMany: vi.fn() },
    todoReminderPolicy: { findMany: vi.fn() },
  },
}))

describe("getAiSuggestionState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.todoReminderPolicy.findMany).mockResolvedValue([])
  })

  it("limits contact/deal communication reads and selects only suggestion fields", async () => {
    vi.mocked(db.communication.findMany).mockResolvedValue([])

    await getAiSuggestionState({ entityType: "contact", entityId: "contact-1" })

    expect(db.communication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contactId: "contact-1" },
        take: 50,
        select: expect.objectContaining({
          id: true,
          metadata: true,
          scrubQueue: { select: { status: true } },
        }),
      })
    )
  })

  it("returns queue, stale, snooze, and linked-candidate evidence state", async () => {
    vi.mocked(db.communication.findMany).mockResolvedValue([
      {
        id: "comm-1",
        subject: "Lead email",
        date: new Date("2026-04-27T12:00:00.000Z"),
        metadata: {
          scrub: {
            summary: "Needs follow up",
            urgency: "soon",
            replyRequired: true,
            topicTags: ["lead"],
            linkedContactCandidates: [
              {
                contactId: "contact-2",
                confidence: 0.9,
                reason: "email",
              },
              {
                contactId: "contact-noise",
                confidence: 0.1,
                reason: "weak",
              },
            ],
          },
        },
        scrubQueue: { status: "done" },
      } as never,
    ])
    vi.mocked(db.agentAction.findMany).mockResolvedValue([
      {
        id: "action-1",
        actionType: "create-todo",
        status: "pending",
        tier: "approve",
        summary: "Follow up",
        payload: {},
        sourceCommunicationId: "comm-1",
        targetEntity: null,
        promptVersion: "old",
        duplicateOfActionId: null,
        dedupedToTodoId: null,
        createdAt: new Date("2026-04-27T12:01:00.000Z"),
        sourceCommunication: {
          id: "comm-1",
          archivedAt: null,
          subject: "Lead email",
          date: new Date("2026-04-27T12:00:00.000Z"),
          externalMessageId: "outlook-1",
          metadata: {
            scrub: {
              summary: "Needs follow up",
              linkedContactCandidates: [
                {
                  contactId: "contact-2",
                  confidence: 0.9,
                  reason: "email",
                },
              ],
            },
          },
        },
      } as never,
    ])
    vi.mocked(db.todoReminderPolicy.findMany).mockResolvedValue([
      {
        agentActionId: "action-1",
        snoozedUntil: new Date("2026-04-28T12:00:00.000Z"),
      } as never,
    ])

    const state = await getAiSuggestionState({
      entityType: "contact",
      entityId: "contact-1",
      surface: "lead",
    })

    expect(state.queue.done).toBe(1)
    expect(state.scrubbedCommunications).toHaveLength(1)
    expect(state.actions[0]).toMatchObject({
      id: "action-1",
      isSnoozed: true,
      snoozedUntil: "2026-04-28T12:00:00.000Z",
      linkedContactCandidates: [
        expect.objectContaining({ id: "contact-2", confidence: 0.9 }),
      ],
      evidence: expect.objectContaining({
        outlookUrl: "https://outlook.office.com/mail/deeplink/read/outlook-1",
      }),
    })
  })
})
