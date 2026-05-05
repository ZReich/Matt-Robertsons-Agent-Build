import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import {
  archivePrismaTodoFromVaultPath,
  listDashboardPrismaTodoNotesWithContexts,
  listPrismaTodoNotesWithContexts,
  updatePrismaTodoFromVaultPath,
} from "./prisma-todo-notes"

vi.mock("@/lib/prisma", () => ({
  db: {
    todo: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe("listPrismaTodoNotesWithContexts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns synthetic note paths that align with context keys", async () => {
    vi.mocked(db.todo.findMany).mockResolvedValue([
      prismaTodo({
        id: "todo-1",
        contact: {
          id: "contact-1",
          name: "Alex Wright",
          company: null,
          email: null,
          phone: null,
          role: null,
          preferredContact: null,
        },
      }),
    ])

    const result = await listPrismaTodoNotesWithContexts()

    expect(result.notes[0]?.path).toBe("prisma-todos/todo-1")
    expect(result.contexts).toHaveProperty(result.notes[0]!.path)
    expect(result.contexts[result.notes[0]!.path]).toMatchObject({
      person: { name: "Alex Wright", slug: "contact-1" },
    })
  })

  it("prefers direct contact and deal labels over communication fallbacks", async () => {
    vi.mocked(db.todo.findMany).mockResolvedValue([
      prismaTodo({
        contact: {
          id: "contact-direct",
          name: "Direct Contact",
          company: null,
          email: null,
          phone: null,
          role: null,
          preferredContact: null,
        },
        deal: {
          id: "deal-direct",
          propertyAddress: "Direct Deal Address",
          propertyType: "office",
          stage: "prospecting",
          value: null,
          squareFeet: null,
          closingDate: null,
          keyContacts: null,
          contact: { name: "Direct Contact" },
        },
        communication: {
          id: "comm-1",
          channel: "email",
          subject: "Subject fallback",
          date: new Date("2026-04-27T12:00:00.000Z"),
          externalMessageId: "outlook-1",
          contact: { name: "Email Sender" },
          deal: { propertyAddress: "Fallback Property" },
        },
      }),
    ])

    const note = (await listPrismaTodoNotesWithContexts()).notes[0]!

    expect(note.meta.contact).toBe("Direct Contact")
    expect(note.meta.deal).toBe("Direct Deal Address")
    expect(note.meta.source_communication).toBe("communication:comm-1")
  })

  it("uses communication labels and subject when direct relations/body are missing", async () => {
    vi.mocked(db.todo.findMany).mockResolvedValue([
      prismaTodo({
        body: null,
        contact: null,
        deal: null,
        communication: {
          id: "comm-1",
          channel: "email",
          subject: "Subject fallback",
          date: new Date("2026-04-27T12:00:00.000Z"),
          externalMessageId: null,
          contact: { name: "Email Sender" },
          deal: { propertyAddress: "Fallback Property" },
        },
      }),
    ])

    const note = (await listPrismaTodoNotesWithContexts()).notes[0]!

    expect(note.meta.contact).toBe("Email Sender")
    expect(note.meta.deal).toBe("Fallback Property")
    expect(note.content).toBe("Subject fallback")
  })

  it("uses a dashboard-scoped Prisma query for active urgent or due todos", async () => {
    vi.mocked(db.todo.findMany).mockResolvedValue([])

    await listDashboardPrismaTodoNotesWithContexts(
      new Date("2026-04-27T12:00:00.000Z")
    )
    const expectedNextDay = new Date(2026, 3, 28)

    expect(db.todo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          archivedAt: null,
          status: { in: ["pending", "in_progress"] },
          OR: [
            { priority: { in: ["urgent", "high"] } },
            { dueDate: { lt: expectedNextDay } },
          ],
        },
      })
    )
  })
})

describe("updatePrismaTodoFromVaultPath", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when the underlying todo no longer exists (P2025)", async () => {
    const notFound = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    })
    vi.mocked(db.todo.update).mockRejectedValue(notFound)

    const result = await updatePrismaTodoFromVaultPath(
      "prisma-todos/missing-id",
      { status: "done" }
    )

    expect(result).toBeNull()
  })

  it("rethrows non-P2025 prisma errors", async () => {
    vi.mocked(db.todo.update).mockRejectedValue(new Error("connection refused"))

    await expect(
      updatePrismaTodoFromVaultPath("prisma-todos/abc", { status: "done" })
    ).rejects.toThrow("connection refused")
  })
})

describe("archivePrismaTodoFromVaultPath", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when the underlying todo no longer exists (P2025)", async () => {
    const notFound = Object.assign(new Error("Record to update not found."), {
      code: "P2025",
    })
    vi.mocked(db.todo.update).mockRejectedValue(notFound)

    const result = await archivePrismaTodoFromVaultPath(
      "prisma-todos/missing-id"
    )

    expect(result).toBeNull()
  })
})

function prismaTodo(overrides = {}) {
  return {
    id: "todo-1",
    title: "Follow up",
    body: "Body",
    status: "pending" as const,
    priority: "high" as const,
    dueDate: null,
    category: "business" as const,
    tags: [],
    createdBy: "agent",
    archivedAt: null,
    contactId: null,
    dealId: null,
    communicationId: "comm-1",
    agentActionId: "action-1",
    createdAt: new Date("2026-04-27T10:00:00.000Z"),
    updatedAt: new Date("2026-04-27T11:00:00.000Z"),
    dedupeKey: null,
    metadata: {},
    contact: null,
    deal: null,
    communication: null,
    ...overrides,
  }
}
