import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  extractOutboundRecipientEmails,
  loadOpenTodoCandidates,
} from "./scrub-linker"

vi.mock("@/lib/prisma", () => ({
  db: {
    contact: { findMany: vi.fn() },
    communication: { findMany: vi.fn(), count: vi.fn() },
    todo: { findMany: vi.fn() },
  },
}))

describe("scrub linker outbound todo candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.contact.findMany).mockResolvedValue([])
    vi.mocked(db.communication.findMany).mockResolvedValue([])
    vi.mocked(db.todo.findMany).mockResolvedValue([])
  })

  it("extracts bounded outbound recipient emails from metadata", () => {
    const emails = extractOutboundRecipientEmails({
      toRecipients: [
        { emailAddress: { address: "Buyer@Example.com" } },
        { emailAddress: { address: "buyer@example.com" } },
      ],
      ccRecipients: [{ emailAddress: { address: "Broker@Example.com" } }],
    })

    expect(emails).toEqual(["buyer@example.com", "broker@example.com"])
  })

  it("matches outbound recipients to contact emails for open todo context", async () => {
    vi.mocked(db.contact.findMany).mockResolvedValue([
      { id: "contact-recipient" },
    ] as never)
    vi.mocked(db.todo.findMany).mockResolvedValue([
      {
        id: "todo-1",
        title: "Send LOI",
        status: "pending",
        dueDate: null,
        contactId: "contact-recipient",
        dealId: null,
        communicationId: null,
        createdAt: new Date("2026-04-27T12:00:00.000Z"),
        updatedAt: new Date("2026-04-27T13:00:00.000Z"),
      },
    ] as never)

    const todos = await loadOpenTodoCandidates(
      {
        id: "comm-outbound",
        conversationId: null,
        contactId: null,
        dealId: null,
        direction: "outbound",
        metadata: {
          toRecipients: [{ emailAddress: { address: "buyer@example.com" } }],
        },
      },
      { contacts: [], deals: [] }
    )

    expect(db.contact.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        email: { in: ["buyer@example.com"], mode: "insensitive" },
      },
      take: 25,
      select: { id: true },
    })
    expect(db.todo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ contactId: "contact-recipient" }]),
        }),
      })
    )
    expect(todos[0]).toMatchObject({
      id: "todo-1",
      createdAt: "2026-04-27T12:00:00.000Z",
    })
  })
})
