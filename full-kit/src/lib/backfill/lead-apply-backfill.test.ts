import { beforeEach, describe, expect, it, vi } from "vitest"

import { runLeadApplyBackfill } from "./lead-apply-backfill"

describe("lead-apply-backfill", () => {
  beforeEach(() => {
    delete process.env.CONTACT_AUTO_PROMOTION_MODE
  })

  it("dry-runs confirmed signal extractor-email rows without writes", async () => {
    const client = makeClient({
      rows: [leadRow()],
      contacts: [],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: true, limit: 25, runId: "run-1" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      would_create_contact_candidate: 1,
    })
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
    expect(client.communication.updateMany).not.toHaveBeenCalled()
    expect(client.$queryRaw).not.toHaveBeenCalled()
  })

  it("applies candidate creation without creating or linking a Contact", async () => {
    const client = makeClient({ rows: [leadRow()], contacts: [] })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ created_contact_candidate: 1 })
    expect(result.createdLeadContacts).toBe(0)
    expect(result.createdContactCandidates).toBe(1)
    expect(result.communicationLinked).toBe(0)
    expect(client.$queryRaw).toHaveBeenCalledTimes(2)
    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(client.contactPromotionCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedEmail: "dana@example.com",
          sourcePlatform: "loopnet",
          communicationId: "comm-1",
          metadata: expect.objectContaining({
            communicationIds: ["comm-1"],
          }),
        }),
      })
    )
    expect(client.communication.updateMany).not.toHaveBeenCalled()
  })

  it("dry-runs unknown non-platform signal senders as contact candidates", async () => {
    const client = makeClient({
      rows: [senderRow()],
      contacts: [],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: true, limit: 25, runId: "run-1" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      would_create_contact_candidate: 1,
    })
    expect(result.samples[0]).toMatchObject({
      communicationId: "comm-sender-1",
      inquirerEmail: "tenant@example.com",
      extractedKind: "known-counterparty",
    })
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
  })

  it("applies contact candidates for unknown non-platform signal senders", async () => {
    const client = makeClient({ rows: [senderRow()], contacts: [] })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ created_contact_candidate: 1 })
    expect(result.createdContactCandidates).toBe(1)
    expect(client.contactPromotionCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: "email-sender:tenant@example.com",
          normalizedEmail: "tenant@example.com",
          displayName: "Tenant Prospect",
          source: "historical-email-sender-backfill",
          sourceKind: "known-counterparty",
          communicationId: "comm-sender-1",
        }),
      })
    )
    expect(client.communication.updateMany).not.toHaveBeenCalled()
  })

  it("dry-runs strong unknown sender evidence as auto-create", async () => {
    const client = makeClient({
      rows: [strongSenderRow()],
      contacts: [],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: true, limit: 25, runId: "run-1" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      would_auto_create_sender_contact: 1,
    })
    expect(client.contact.create).not.toHaveBeenCalled()
  })

  it("write mode auto-creates a sender contact for strong historical evidence", async () => {
    process.env.CONTACT_AUTO_PROMOTION_MODE = "write"
    const client = makeClient({
      rows: [strongSenderRow()],
      contacts: [],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ created_sender_contact: 1 })
    expect(result.createdSenderContacts).toBe(1)
    expect(result.communicationLinked).toBe(1)
    expect(client.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "tenant@example.com",
          createdBy: "historical-email-sender-auto-promotion",
        }),
      })
    )
    expect(client.communication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-created",
          metadata: expect.objectContaining({
            backfill: expect.objectContaining({
              leadApply: expect.objectContaining({
                outcome: "created_sender_contact",
                autoPromotion: expect.objectContaining({
                  decision: "auto_create_contact",
                }),
              }),
            }),
          }),
        }),
      })
    )
  })

  it("links existing contacts for historical non-platform signal senders", async () => {
    const client = makeClient({
      rows: [senderRow()],
      contacts: [
        contact({
          id: "contact-tenant",
          email: "tenant@example.com",
          deals: 0,
        }),
      ],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ linked_existing_contact: 1 })
    expect(result.communicationLinked).toBe(1)
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
    expect(client.communication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-tenant",
          metadata: expect.objectContaining({
            backfill: expect.objectContaining({
              leadApply: expect.objectContaining({
                strategy: "historical-email-sender-backfill",
                inquirerEmail: "tenant@example.com",
              }),
            }),
          }),
        }),
      })
    )
  })

  it("creates Buildout lead Contacts when the event has inquirer email evidence", async () => {
    const client = makeClient({
      rows: [
        leadRow({
          subject:
            "Rockets | Gourmet Wraps & Sodas - Information Requested by Shae Nielsen",
          body: "Profile information on file for Shae Nielsen: Email shae@example.com Phone 406.555.0100",
          metadata: {
            classification: "signal",
            source: "buildout-lead",
            from: { address: "support@buildout.com" },
          },
        }),
      ],
      contacts: [],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ created_lead_contact: 1 })
    expect(result.createdLeadContacts).toBe(1)
    expect(result.communicationLinked).toBe(1)
    expect(client.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "shae@example.com",
          name: "Shae Nielsen",
          phone: "406.555.0100",
          leadSource: "buildout",
          leadStatus: "new",
        }),
      })
    )
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
    expect(client.communication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-created",
        }),
      })
    )
  })

  it("does not double-count the same communication as candidate evidence", async () => {
    const client = makeClient({
      rows: [leadRow()],
      contacts: [],
      existingCandidate: {
        id: "candidate-1",
        status: "pending",
        metadata: { firstCommunicationId: "comm-1" },
      },
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ updated_contact_candidate: 1 })
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
    expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          evidenceCount: expect.anything(),
        }),
      })
    )
  })

  it.each(["not_a_contact", "rejected"] as const)(
    "reopens a %s candidate only when new evidence arrives",
    async (status) => {
      const client = makeClient({
        rows: [leadRow({ id: "comm-2" })],
        contacts: [],
        existingCandidate: {
          id: "candidate-1",
          status,
          metadata: {
            communicationIds: ["comm-1"],
            promotionReview: {
              status,
              reviewer: "Matt",
              reason: "not enough evidence",
              decidedAt: "2026-04-24T00:00:00.000Z",
            },
          },
        },
      })

      const result = await runLeadApplyBackfill({
        request: { dryRun: false, limit: 25, runId: "run-apply" },
        client: client as never,
      })

      expect(result.byOutcome).toMatchObject({ updated_contact_candidate: 1 })
      expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "needs_more_evidence",
            snoozedUntil: null,
            communicationId: "comm-2",
            evidenceCount: { increment: 1 },
            metadata: expect.objectContaining({
              reopenedFromStatus: status,
              reopenReason: "new-material-communication-evidence",
              reopenEvidenceIds: ["comm-2"],
              communicationIds: ["comm-1", "comm-2"],
              priorTerminalDecision: expect.objectContaining({
                status,
                reviewer: "Matt",
                reason: "not enough evidence",
              }),
              reopenHistory: [
                expect.objectContaining({
                  reopenedFromStatus: status,
                  reopenEvidenceIds: ["comm-2"],
                }),
              ],
            }),
          }),
        })
      )
    }
  )

  it("keeps a terminal candidate closed when evidence is unchanged", async () => {
    const client = makeClient({
      rows: [leadRow({ id: "comm-1" })],
      contacts: [],
      existingCandidate: {
        id: "candidate-1",
        status: "rejected",
        metadata: { communicationIds: ["comm-1"] },
      },
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ updated_contact_candidate: 1 })
    expect(client.contactPromotionCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          status: "needs_more_evidence",
          evidenceCount: expect.anything(),
          communicationId: expect.anything(),
        }),
      })
    )
  })

  it("links existing contacts without mutating lead status", async () => {
    const client = makeClient({
      rows: [
        leadRow(),
        leadRow({ id: "comm-2", body: bodyFor("client@example.com") }),
      ],
      contacts: [
        contact({
          id: "contact-existing",
          email: "dana@example.com",
          deals: 0,
        }),
        contact({
          id: "contact-client",
          email: "client@example.com",
          deals: 1,
        }),
      ],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      linked_existing_contact: 2,
    })
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
    expect(client.communication.updateMany).toHaveBeenCalledTimes(2)
  })

  it("dry-run skips duplicate contact-email matches as ambiguous", async () => {
    const client = makeClient({
      rows: [leadRow()],
      contacts: [
        contact({ id: "contact-a", email: "dana@example.com", deals: 0 }),
        contact({ id: "contact-b", email: "dana@example.com", deals: 1 }),
      ],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: true, limit: 25, runId: "run-1" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      skipped_ambiguous_contact: 1,
    })
    expect(client.communication.updateMany).not.toHaveBeenCalled()
  })

  it("write mode never links duplicate contact-email matches", async () => {
    const client = makeClient({
      rows: [leadRow()],
      contacts: [
        contact({ id: "contact-a", email: "dana@example.com", deals: 0 }),
        contact({ id: "contact-b", email: "dana@example.com", deals: 1 }),
      ],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      skipped_ambiguous_contact: 1,
    })
    expect(client.communication.updateMany).not.toHaveBeenCalled()
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
  })

  it("links an existing lead contact without re-upserting it", async () => {
    const client = makeClient({
      rows: [leadRow()],
      contacts: [
        contact({
          id: "contact-lead",
          email: "dana@example.com",
          deals: 0,
          leadSource: "loopnet",
        }),
      ],
    })
    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      linked_existing_contact: 1,
    })
    expect(client.contactPromotionCandidate.create).not.toHaveBeenCalled()
    expect(result.communicationLinked).toBe(1)
  })

  it("skips non-signal and missing-email rows", async () => {
    const client = makeClient({
      rows: [
        leadRow({
          id: "noise",
          metadata: {
            classification: "noise",
            from: { address: "leads@loopnet.com" },
          },
        }),
        leadRow({
          id: "no-email",
          subject: "3 new leads found for West Park",
          body: "",
          metadata: {
            classification: "signal",
            source: "crexi-lead",
            from: { address: "emails@notifications.crexi.com" },
          },
        }),
      ],
      contacts: [],
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: true, limit: 25, runId: "run-1" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({
      skipped_noise: 1,
      skipped_no_inquirer_email: 1,
    })
  })

  it("requires runId and explicit <=100 limit for write mode", async () => {
    await expect(
      runLeadApplyBackfill({
        request: { dryRun: false, limit: 25 },
        client: makeClient({ rows: [], contacts: [] }) as never,
      })
    ).rejects.toThrow("runId is required")

    await expect(
      runLeadApplyBackfill({
        request: { dryRun: false, runId: "run-1" },
        client: makeClient({ rows: [], contacts: [] }) as never,
      })
    ).rejects.toThrow("limit is required")

    await expect(
      runLeadApplyBackfill({
        request: { dryRun: false, runId: "run-1", limit: 101 },
        client: makeClient({ rows: [], contacts: [] }) as never,
      })
    ).rejects.toThrow("limit must be <= 100")
  })

  it("reports race-lost when communication contact changes before update", async () => {
    const client = makeClient({
      rows: [leadRow()],
      contacts: [
        contact({
          id: "contact-existing",
          email: "dana@example.com",
          deals: 0,
        }),
      ],
      updateCount: 0,
    })

    const result = await runLeadApplyBackfill({
      request: { dryRun: false, limit: 25, runId: "run-apply" },
      client: client as never,
    })

    expect(result.byOutcome).toMatchObject({ skipped_race_lost: 1 })
    expect(result.createdLeadContacts).toBe(0)
  })
})

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "comm-1",
    subject: "LoopNet Lead for 303 N Broadway",
    body: bodyFor("dana@example.com"),
    metadata: {
      classification: "signal",
      source: "loopnet-lead",
      from: { address: "leads@loopnet.com" },
    },
    date: new Date("2026-04-25T12:00:00Z"),
    contactId: null,
    ...overrides,
  }
}

function senderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "comm-sender-1",
    subject: "Lease question",
    body: "Can we talk about suite 200?",
    metadata: {
      classification: "signal",
      source: "known-counterparty",
      from: {
        address: "tenant@example.com",
        displayName: "Tenant Prospect",
        isInternal: false,
      },
    },
    date: new Date("2026-04-25T13:00:00Z"),
    contactId: null,
    ...overrides,
  }
}

function strongSenderRow() {
  return senderRow({
    metadata: {
      classification: "signal",
      source: "known-counterparty",
      from: {
        address: "tenant@example.com",
        displayName: "Tenant Prospect",
        isInternal: false,
      },
      attachmentFetch: {
        status: "success",
        nonInlineCount: 1,
      },
      attachments: [
        {
          id: "att-1",
          name: "space-plan.pdf",
          contentType: "application/pdf",
          isInline: false,
        },
      ],
      behavioralHints: {
        mattRepliedBefore: true,
        threadSize: 2,
      },
    },
  })
}

function bodyFor(email: string): string {
  return `New Lead From: Dana Lead | 406-555-0100 | ${email} | Listing ID 123`
}

function contact({
  id,
  email,
  deals,
  leadSource = null,
  archivedAt = null,
}: {
  id: string
  email: string
  deals: number
  leadSource?: string | null
  archivedAt?: Date | null
}) {
  return {
    id,
    email,
    archivedAt,
    leadSource,
    leadStatus: leadSource ? "new" : null,
    _count: { deals },
  }
}

function makeClient({
  rows,
  contacts,
  existingCandidate = null,
  updateCount = 1,
}: {
  rows: unknown[]
  contacts: unknown[]
  existingCandidate?: unknown
  updateCount?: number
}) {
  const tx = {
    $queryRaw: vi.fn(async () => [{ locked: true }]),
    $executeRaw: vi.fn(async () => 1),
    communication: {
      updateMany: vi.fn(async () => ({ count: updateCount })),
    },
    contact: {
      findMany: vi.fn(async () => contacts),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "contact-created" })),
    },
    contactPromotionCandidate: {
      findUnique: vi.fn(async () => existingCandidate),
      create: vi.fn(async () => ({ id: "candidate-1" })),
      update: vi.fn(async () => ({ id: "candidate-1" })),
    },
  }
  const client = {
    communication: {
      findMany: vi.fn(async () => rows),
      updateMany: tx.communication.updateMany,
    },
    contact: {
      findMany: vi.fn(async () => contacts),
      findFirst: tx.contact.findFirst,
      create: tx.contact.create,
    },
    contactPromotionCandidate: tx.contactPromotionCandidate,
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ got: true }])
      .mockResolvedValueOnce([{ unlocked: true }]),
    $transaction: vi.fn(async (fn) => fn(tx)),
  }
  return client
}
