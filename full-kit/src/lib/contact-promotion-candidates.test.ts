import { describe, expect, it, vi } from "vitest"

import {
  listContactPromotionCandidates,
  reviewContactPromotionCandidate,
} from "./contact-promotion-candidates"

describe("contact promotion candidate review", () => {
  it("dedupes repeated evidence communication IDs for the review UI", async () => {
    const row = candidate({
      communicationId: "comm-1",
      metadata: {
        communicationIds: ["comm-1", "comm-2", "comm-1"],
        leadSource: "buildout",
      },
    })
    const client = {
      contactPromotionCandidate: {
        findMany: vi.fn(async () => [row]),
      },
      communication: {
        findMany: vi.fn(async () => [
          communication("comm-1", "2026-04-25T12:00:00Z"),
          communication("comm-2", "2026-04-26T12:00:00Z"),
        ]),
      },
      contact: {
        findMany: vi.fn(async () => []),
      },
    }

    const [reviewRow] = await listContactPromotionCandidates({
      client: client as never,
    })

    expect(reviewRow.evidenceCommunications.map(({ id }) => id)).toEqual([
      "comm-2",
      "comm-1",
    ])
  })

  it("approves a candidate by creating one Contact and preserving evidence", async () => {
    const client = makeClient({ candidate: candidate() })

    const result = await reviewContactPromotionCandidate({
      id: "candidate-1",
      action: "approve_create_contact",
      reviewer: "zach",
      now: now(),
      client: client as never,
    })

    expect(result.idempotent).toBe(false)
    expect(client.contact.create).toHaveBeenCalledTimes(1)
    expect(client.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Dana Lead",
          email: "dana@example.com",
          leadSource: "buildout",
          leadStatus: "new",
          createdBy: "candidate-review",
          notes: expect.stringContaining("Candidate ID: candidate-1"),
        }),
      })
    )
    expect(client.communication.updateMany).toHaveBeenCalledTimes(2)
    for (const communicationId of ["comm-1", "comm-2"]) {
      expect(client.communication.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: communicationId }),
          data: expect.objectContaining({
            contactId: "contact-created",
            metadata: expect.objectContaining({
              source: "original",
              promotionReview: expect.objectContaining({
                candidateId: "candidate-1",
                contactId: "contact-created",
              }),
            }),
          }),
        })
      )
    }
    expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          approvedContactId: "contact-created",
          metadata: expect.objectContaining({
            promotionReview: expect.objectContaining({
              action: "approve_create_contact",
              contactCreated: true,
              evidenceSnapshot: expect.objectContaining({
                normalizedEmail: "dana@example.com",
                evidenceCount: 2,
              }),
            }),
            promotionReviewHistory: [
              expect.objectContaining({ action: "approve_create_contact" }),
            ],
          }),
        }),
      })
    )
  })

  it("links approval to an existing Contact without creating a duplicate", async () => {
    const client = makeClient({
      candidate: candidate(),
      contact: existingContact(),
    })

    const result = await reviewContactPromotionCandidate({
      id: "candidate-1",
      action: "approve_link_contact",
      contactId: "contact-existing",
      now: now(),
      client: client as never,
    })

    expect(result.contact?.id).toBe("contact-existing")
    expect(client.contact.create).not.toHaveBeenCalled()
    expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "merged",
          approvedContactId: "contact-existing",
        }),
      })
    )
  })

  it("makes repeated approval idempotent", async () => {
    const client = makeClient({
      candidate: candidate({
        status: "approved",
        approvedContactId: "contact-created",
      }),
      contact: existingContact({ id: "contact-created" }),
    })

    const result = await reviewContactPromotionCandidate({
      id: "candidate-1",
      action: "approve_create_contact",
      now: now(),
      client: client as never,
    })

    expect(result.idempotent).toBe(true)
    expect(result.contact?.id).toBe("contact-created")
    expect(client.contact.create).not.toHaveBeenCalled()
    expect(client.contactPromotionCandidate.update).not.toHaveBeenCalled()
    expect(client.communication.updateMany).not.toHaveBeenCalled()
  })

  it("rejects candidates without creating Contacts", async () => {
    const client = makeClient({ candidate: candidate() })

    const result = await reviewContactPromotionCandidate({
      id: "candidate-1",
      action: "reject",
      reason: "Broker newsletter sender, not an inquirer.",
      now: now(),
      client: client as never,
    })

    expect(result.contact).toBeNull()
    expect(client.contact.create).not.toHaveBeenCalled()
    expect(client.communication.updateMany).not.toHaveBeenCalled()
    expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          approvedContactId: undefined,
          metadata: expect.objectContaining({
            promotionReview: expect.objectContaining({
              action: "reject",
              reason: "Broker newsletter sender, not an inquirer.",
            }),
          }),
        }),
      })
    )
  })

  it("does not reverse a terminal approved decision", async () => {
    const client = makeClient({
      candidate: candidate({
        status: "approved",
        approvedContactId: "contact-created",
      }),
    })

    await expect(
      reviewContactPromotionCandidate({
        id: "candidate-1",
        action: "reject",
        now: now(),
        client: client as never,
      })
    ).rejects.toThrow("candidate is already approved")
    expect(client.contactPromotionCandidate.update).not.toHaveBeenCalled()
    expect(client.contact.create).not.toHaveBeenCalled()
  })

  it("rejects a relink request to a different Contact after approval", async () => {
    const client = makeClient({
      candidate: candidate({
        status: "merged",
        approvedContactId: "contact-existing",
      }),
      contact: existingContact({ id: "contact-other" }),
    })

    await expect(
      reviewContactPromotionCandidate({
        id: "candidate-1",
        action: "approve_link_contact",
        contactId: "contact-other",
        now: now(),
        client: client as never,
      })
    ).rejects.toThrow("candidate is already linked to another contact")
    expect(client.contactPromotionCandidate.update).not.toHaveBeenCalled()
  })

  it("routes create approval to an existing same-email Contact", async () => {
    const duplicate = existingContact({ id: "contact-duplicate" })
    const client = makeClient({
      candidate: candidate(),
      contact: duplicate,
      duplicateContact: duplicate,
    })

    const result = await reviewContactPromotionCandidate({
      id: "candidate-1",
      action: "approve_create_contact",
      now: now(),
      client: client as never,
    })

    expect(result.contact?.id).toBe("contact-duplicate")
    expect(client.contact.create).not.toHaveBeenCalled()
    expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "merged",
          approvedContactId: "contact-duplicate",
        }),
      })
    )
  })
})

function now() {
  return new Date("2026-04-27T04:30:00Z")
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-1",
    normalizedEmail: "dana@example.com",
    displayName: "Dana Lead",
    company: "Dana Co",
    phone: "406-555-0100",
    message: "Interested in the listing.",
    source: "historical-platform-lead-apply",
    sourcePlatform: "buildout",
    sourceKind: "information_requested",
    status: "pending",
    confidenceScore: null,
    evidenceCount: 2,
    firstSeenAt: new Date("2026-04-25T12:00:00Z"),
    lastSeenAt: new Date("2026-04-26T12:00:00Z"),
    suggestedContactId: null,
    approvedContactId: null,
    communicationId: "comm-1",
    dedupeKey: "platform-lead:buildout:dana@example.com",
    snoozedUntil: null,
    metadata: {
      communicationIds: ["comm-1", "comm-2"],
      leadSource: "buildout",
    },
    createdAt: new Date("2026-04-25T12:00:00Z"),
    updatedAt: new Date("2026-04-26T12:00:00Z"),
    ...overrides,
  }
}

function existingContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-existing",
    name: "Existing Contact",
    company: "Existing Co",
    email: "dana@example.com",
    phone: "406-555-0100",
    leadSource: null,
    leadStatus: null,
    ...overrides,
  }
}

function communication(id: string, date: string) {
  return {
    id,
    subject: `Subject ${id}`,
    body: `Body ${id}`,
    date: new Date(date),
    direction: "inbound",
    contactId: null,
    externalMessageId: null,
    conversationId: null,
    metadata: {},
  }
}

function makeClient({
  candidate,
  contact = existingContact(),
  duplicateContact = null,
}: {
  candidate: unknown
  contact?: unknown
  duplicateContact?: unknown
}) {
  const tx = {
    contactPromotionCandidate: {
      findUnique: vi.fn(async () => candidate),
      update: vi.fn(async ({ data }) => ({
        ...(candidate as Record<string, unknown>),
        ...data,
      })),
    },
    $queryRaw: vi.fn(async () => [{ id: "candidate-1" }]),
    $executeRaw: vi.fn(async () => 1),
    contact: {
      create: vi.fn(async () => existingContact({ id: "contact-created" })),
      findUnique: vi.fn(async () => contact),
      findFirst: vi.fn(async () => duplicateContact),
    },
    communication: {
      findMany: vi.fn(async () => [
        { id: "comm-1", contactId: null, metadata: { source: "original" } },
        { id: "comm-2", contactId: null, metadata: { source: "original" } },
      ]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  }
  return {
    ...tx,
    $transaction: vi.fn(async (fn) => fn(tx)),
  }
}
