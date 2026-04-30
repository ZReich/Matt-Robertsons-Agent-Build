import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { graphFetch } from "./client"
import {
  computeBehavioralHints,
  fetchEmailDelta,
  persistMessage,
  processMessagesConcurrently,
  processOneMessage,
} from "./emails"

vi.mock("@/lib/prisma", () => ({
  db: {
    externalSync: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    scrubQueue: {
      create: vi.fn(),
    },
    contactPromotionCandidate: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    communication: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock("./client", () => ({
  graphFetch: vi.fn(),
}))

vi.mock("./config", () => ({
  loadMsgraphConfig: vi.fn(() => ({
    tenantId: "t",
    clientId: "c",
    clientSecret: "s",
    targetUpn: "matt@example.com",
    testAdminToken: "x".repeat(32),
    testRouteEnabled: true,
  })),
}))

describe("fetchEmailDelta", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses Prefer odata.maxpagesize instead of $top for bootstrap pagination", async () => {
    ;(db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(graphFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        value: [{ id: "g-1" }],
        "@odata.nextLink":
          "https://graph.microsoft.com/v1.0/users/matt@example.com/mailFolders('inbox')/messages/delta?$skiptoken=PAGE2",
      })
      .mockResolvedValueOnce({
        value: [],
        "@odata.deltaLink":
          "https://graph.microsoft.com/v1.0/users/matt@example.com/mailFolders('inbox')/messages/delta?$deltatoken=FINAL",
      })

    const pages = []
    for await (const page of fetchEmailDelta(
      "inbox",
      "2026-01-23T00:00:00.000Z"
    )) {
      pages.push(page)
    }

    expect(graphFetch).toHaveBeenCalledTimes(2)
    const [initialUrl, initialOptions] = (
      graphFetch as ReturnType<typeof vi.fn>
    ).mock.calls[0]

    expect(initialUrl).toContain("/mailFolders/inbox/messages/delta")
    expect(initialUrl).toContain("$filter=")
    expect(initialUrl).toContain("$select=")
    expect(initialUrl).not.toContain("$top=")
    expect(initialOptions.headers.Prefer).toContain('IdType="ImmutableId"')
    expect(initialOptions.headers.Prefer).toContain("odata.maxpagesize=100")
    expect(decodeURIComponent(initialUrl)).not.toContain("body,")
    expect(pages).toHaveLength(2)
    expect(pages[1].isFinal).toBe(true)
  })
})

describe("computeBehavioralHints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("treats any outbound email in the same conversation as Matt engagement", async () => {
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(db.communication.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)

    await expect(
      computeBehavioralHints("prospect@example.com", "thread-1")
    ).resolves.toMatchObject({
      senderInContacts: false,
      mattRepliedBefore: true,
      threadSize: 3,
    })

    expect(db.communication.count).toHaveBeenCalledWith({
      where: {
        direction: "outbound",
        OR: [
          { conversationId: "thread-1" },
          { metadata: { path: ["conversationId"], equals: "thread-1" } },
        ],
      },
    })
  })

  it("also treats a prior direct outbound to the sender as Matt engagement", async () => {
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "contact-1",
    })
    ;(db.communication.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    await expect(
      computeBehavioralHints("prospect@example.com", "thread-2")
    ).resolves.toMatchObject({
      senderInContacts: true,
      mattRepliedBefore: true,
      threadSize: 1,
    })
  })
})

function acquisition(overrides = {}) {
  return {
    classification: "signal" as const,
    source: "known-counterparty" as const,
    tier1Rule: "contact-replied",
    ruleId: "classification-safety-default",
    ruleVersion: 1,
    runMode: "observe" as const,
    bodyDecision: "fetch_body" as const,
    disposition: "fetched_body" as const,
    riskFlags: [],
    rescueFlags: [],
    evidenceSnapshot: {},
    rationale: "test",
    ...overrides,
  }
}

const hints = {
  senderInContacts: false,
  mattRepliedBefore: false,
  threadSize: 1,
  domainIsLargeCreBroker: false,
}

describe("persistMessage scrub enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CONTACT_AUTO_PROMOTION_MODE
    ;(db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
      fn(db)
    )
    ;(db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sync-1",
    })
    ;(db.communication.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "comm-1",
    })
    ;(db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(
      db.contactPromotionCandidate.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.communication.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    ;(db.communication.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "contact-auto",
    })
  })

  it("enqueues signal communications inside the persist transaction", async () => {
    await persistMessage({
      message: {
        id: "graph-1",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-1",
        subject: "Tour",
        body: { contentType: "text", content: "Can we tour?" },
      },
      folder: "inbox",
      normalizedSender: {
        address: "buyer@example.com",
        displayName: "Buyer",
        isInternal: false,
        normalizationFailed: false,
      },
      classification: {
        classification: "signal",
        source: "known-counterparty",
        tier1Rule: "contact-replied",
      },
      acquisition: acquisition(),
      hints,
      extracted: null,
      attachments: undefined,
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.scrubQueue.create).toHaveBeenCalledWith({
      data: { communicationId: "comm-1", status: "pending" },
    })
    expect(db.communication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conversationId: "thread-1" }),
      })
    )
  })

  it("creates a contact candidate for unknown non-platform signal senders", async () => {
    await persistMessage({
      message: {
        id: "graph-candidate-1",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-candidate-1",
        subject: "Lease question",
        body: { contentType: "text", content: "Can we discuss suite 200?" },
      },
      folder: "inbox",
      normalizedSender: {
        address: "tenant@example.com",
        displayName: "Tenant Prospect",
        isInternal: false,
        normalizationFailed: false,
      },
      classification: {
        classification: "signal",
        source: "known-counterparty",
        tier1Rule: "contact-replied",
      },
      acquisition: acquisition(),
      hints,
      extracted: null,
      attachments: undefined,
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.contactPromotionCandidate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: "email-sender:tenant@example.com",
          normalizedEmail: "tenant@example.com",
          displayName: "Tenant Prospect",
          source: "msgraph-email-sender",
          sourceKind: "known-counterparty",
          communicationId: "comm-1",
          metadata: expect.objectContaining({
            communicationIds: ["comm-1"],
          }),
        }),
      })
    )
  })

  it("records provenance when an exact email match links an existing Contact", async () => {
    await persistMessage({
      message: {
        id: "graph-existing-contact",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-existing-contact",
        subject: "Follow up",
      },
      folder: "inbox",
      normalizedSender: {
        address: "tenant@example.com",
        displayName: "Tenant Prospect",
        isInternal: false,
        normalizationFailed: false,
      },
      classification: {
        classification: "signal",
        source: "known-counterparty",
        tier1Rule: "contact-replied",
      },
      acquisition: acquisition(),
      hints,
      extracted: null,
      attachments: undefined,
      contactId: "contact-existing",
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.communication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-existing",
          metadata: expect.objectContaining({
            contactAutoPromotion: expect.objectContaining({
              decision: "auto_link_existing",
              matchedContactId: "contact-existing",
              reasonCodes: ["single_existing_contact_email_match"],
              mode: "pre_insert_exact_match",
            }),
          }),
        }),
      })
    )
  })

  it("does not auto-create contacts for internal single-recipient outbound attachments", async () => {
    process.env.CONTACT_AUTO_PROMOTION_MODE = "write"

    await persistMessage({
      message: {
        id: "graph-internal-outbound",
        sentDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-internal-outbound",
        subject: "Attached",
        toRecipients: [
          { emailAddress: { address: "ops@example.com", name: "Ops" } },
        ],
        hasAttachments: true,
      },
      folder: "sentitems",
      normalizedSender: {
        address: "matt@example.com",
        displayName: "Matt",
        isInternal: true,
        normalizationFailed: false,
      },
      classification: {
        classification: "signal",
        source: "matt-outbound",
        tier1Rule: "sent",
      },
      acquisition: acquisition(),
      hints,
      extracted: null,
      attachments: [
        {
          id: "att-1",
          name: "loi.pdf",
          size: 1000,
          contentType: "application/pdf",
          isInline: false,
        },
      ],
      attachmentFetch: { status: "success", nonInlineCount: 1 },
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.contact.create).not.toHaveBeenCalled()
    expect(db.communication.update).not.toHaveBeenCalled()
  })

  it("does not enqueue noise communications", async () => {
    await persistMessage({
      message: {
        id: "graph-2",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
      },
      folder: "inbox",
      normalizedSender: {
        address: "blast@example.com",
        displayName: "Blast",
        isInternal: false,
        normalizationFailed: false,
      },
      classification: {
        classification: "noise",
        source: "layer-b-domain-drop",
        tier1Rule: "domain",
      },
      acquisition: acquisition({
        classification: "noise",
        source: "layer-b-domain-drop",
        tier1Rule: "domain",
        bodyDecision: "fetch_body",
        disposition: "observed",
      }),
      hints,
      extracted: null,
      attachments: undefined,
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.scrubQueue.create).not.toHaveBeenCalled()
  })

  it("prunes body and bodyPreview from ExternalSync raw graph snapshots", async () => {
    await persistMessage({
      message: {
        id: "graph-3",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        body: { contentType: "text", content: "private body" },
        bodyPreview: "private preview",
      },
      folder: "inbox",
      normalizedSender: {
        address: "blast@example.com",
        displayName: "Blast",
        isInternal: false,
        normalizationFailed: false,
      },
      classification: {
        classification: "noise",
        source: "layer-b-domain-drop",
        tier1Rule: "domain",
      },
      acquisition: acquisition({
        classification: "noise",
        source: "layer-b-domain-drop",
        tier1Rule: "domain",
        bodyDecision: "fetch_body",
        disposition: "observed",
      }),
      hints,
      extracted: null,
      attachments: undefined,
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.externalSync.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawData: expect.objectContaining({
            graphSnapshot: expect.not.objectContaining({
              body: expect.anything(),
              bodyPreview: expect.anything(),
            }),
          }),
        }),
      })
    )
  })
})

describe("processOneMessage contact safety", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "vendor-contact" })
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.communication.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(db.communication.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    ;(db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
      fn(db)
    )
    ;(db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sync-1",
    })
    ;(db.communication.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "comm-1",
    })
    ;(db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(db.communication.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
  })

  it("creates Buildout lead contacts instead of linking to the vendor sender Contact", async () => {
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(db.contact.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "contact-buildout",
    })

    await processOneMessage(
      {
        id: "buildout-1",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-buildout-1",
        subject: "A new Lead has been added - 303 North Broadway",
        from: {
          emailAddress: {
            name: "Buildout Support",
            address: "support@buildout.com",
          },
        },
        body: {
          contentType: "text",
          content:
            "Name Dana Lead Email dana@example.com Phone 406-555-0100 Message Please send info",
        },
      },
      "inbox",
      "observe"
    )

    expect(db.communication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: "contact-buildout",
          metadata: expect.objectContaining({
            extracted: expect.objectContaining({
              platform: "buildout",
              kind: "new-lead",
            }),
            leadContactId: "contact-buildout",
            leadCreated: true,
          }),
        }),
      })
    )
    expect(db.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "dana@example.com",
          leadSource: "buildout",
          leadStatus: "new",
          createdBy: "msgraph-email",
        }),
      })
    )
  })

  it("does not link unparsed platform events to the vendor sender Contact", async () => {
    await processOneMessage(
      {
        id: "buildout-2",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-buildout-2",
        subject: "Critical date changed for 303 North Broadway",
        from: {
          emailAddress: {
            name: "Buildout Support",
            address: "support@buildout.com",
          },
        },
        body: {
          contentType: "text",
          content:
            "This is a critical date notification with an unknown shape.",
        },
      },
      "inbox",
      "observe"
    )

    expect(db.communication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: null,
          metadata: expect.objectContaining({
            classification: "signal",
            source: "buildout-event",
          }),
        }),
      })
    )
    expect(db.contactPromotionCandidate.create).not.toHaveBeenCalled()
  })

  it("does not silently link duplicate non-platform sender email matches", async () => {
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "contact-1" },
      { id: "contact-2" },
    ])

    await processOneMessage(
      {
        id: "regular-duplicate-1",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-duplicate-1",
        subject: "Lease question",
        from: {
          emailAddress: {
            name: "Tenant Prospect",
            address: "tenant@example.com",
          },
        },
        body: {
          contentType: "text",
          content: "Can we discuss suite 200?",
        },
      },
      "inbox",
      "observe"
    )

    expect(db.communication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: null }),
      })
    )
  })
})

describe("processOneMessage buyer-rep signal hook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CONTACT_AUTO_PROMOTION_MODE
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "contact-broker" },
    ])
    ;(db.communication.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(db.communication.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    ;(db.externalSync.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(db.$transaction as ReturnType<typeof vi.fn>).mockImplementation((fn) =>
      fn(db)
    )
    ;(db.externalSync.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "sync-br",
    })
    ;(db.communication.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "comm-br",
    })
    ;(db.externalSync.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(db.communication.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(db.agentAction.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "action-br",
    })
  })

  it("proposes a create-deal AgentAction for outbound LOI emails to broker domains", async () => {
    await processOneMessage(
      {
        id: "outbound-loi-1",
        sentDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-loi-1",
        subject: "LOI draft for 303 N Broadway",
        from: {
          emailAddress: {
            name: "Matt",
            address: "matt@naibusinessproperties.com",
          },
        },
        toRecipients: [
          { emailAddress: { address: "agent@cushwake.com", name: "Agent" } },
        ],
        body: {
          contentType: "text",
          content: "Attached is the letter of intent for our review.",
        },
      },
      "sentitems",
      "observe"
    )

    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "create-deal",
        tier: "approve",
        sourceCommunicationId: "comm-br",
        payload: expect.objectContaining({
          contactId: "contact-broker",
          recipientEmail: "agent@cushwake.com",
          recipientDisplayName: "Agent",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: "offer",
          signalType: "loi",
        }),
      }),
    })
  })

  it("fires when ingest contactId is null but recipient email matches an existing Contact", async () => {
    // No contact match for the sender — ingest leaves persisted.contactId null.
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    // Hook fallback lookup for the external recipient finds a Contact.
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "contact-recipient-match",
    })

    await processOneMessage(
      {
        id: "outbound-loi-2",
        sentDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-loi-2",
        subject: "LOI for 500 Main",
        from: {
          emailAddress: {
            name: "Matt",
            address: "matt@naibusinessproperties.com",
          },
        },
        toRecipients: [
          {
            emailAddress: {
              address: "broker@colliers.com",
              name: "Broker",
            },
          },
        ],
        body: {
          contentType: "text",
          content: "Attached is the letter of intent for our review.",
        },
      },
      "sentitems",
      "observe"
    )

    expect(db.contact.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "broker@colliers.com", mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true },
    })
    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "create-deal",
        tier: "approve",
        sourceCommunicationId: "comm-br",
        payload: expect.objectContaining({
          contactId: "contact-recipient-match",
          recipientEmail: "broker@colliers.com",
          recipientDisplayName: "Broker",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          signalType: "loi",
        }),
      }),
    })
  })

  it("fires when ingest contactId is null and recipient is brand new (passes recipientEmail through)", async () => {
    // No contact match for sender — persisted.contactId stays null.
    ;(db.contact.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    // Recipient lookup also misses — payload carries recipientEmail with
    // contactId=null. createDealFromAction will auto-create at approval time.
    ;(db.contact.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await processOneMessage(
      {
        id: "outbound-tour-3",
        sentDateTime: "2026-04-24T12:00:00.000Z",
        conversationId: "thread-tour-3",
        subject: "Tour scheduling for 100 Elm",
        from: {
          emailAddress: {
            name: "Matt",
            address: "matt@naibusinessproperties.com",
          },
        },
        toRecipients: [
          {
            emailAddress: {
              address: "newbroker@example.com",
              name: "New Broker",
            },
          },
        ],
        body: {
          contentType: "text",
          content:
            "Looking to schedule a tour next week — what time slot works for a showing?",
        },
      },
      "sentitems",
      "observe"
    )

    expect(db.agentAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "create-deal",
        tier: "approve",
        sourceCommunicationId: "comm-br",
        payload: expect.objectContaining({
          contactId: null,
          recipientEmail: "newbroker@example.com",
          recipientDisplayName: "New Broker",
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          signalType: "tour",
        }),
      }),
    })
  })
})

describe("processMessagesConcurrently", () => {
  it("calls each item's handler exactly once", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const seen: number[] = []
    await processMessagesConcurrently(items, 3, async (n) => {
      seen.push(n)
    })
    expect(seen.sort((a, b) => a - b)).toEqual(items)
  })

  it("respects the concurrency limit", async () => {
    let inFlight = 0
    let maxObserved = 0
    await processMessagesConcurrently(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      async () => {
        inFlight++
        if (inFlight > maxObserved) maxObserved = inFlight
        // Yield to allow other workers to start before we release the slot.
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
      }
    )
    expect(maxObserved).toBeLessThanOrEqual(4)
    expect(maxObserved).toBeGreaterThan(1)
  })

  it("returns immediately when items is empty", async () => {
    const handler = vi.fn(async () => {})
    await processMessagesConcurrently([], 10, handler)
    expect(handler).not.toHaveBeenCalled()
  })

  it("clamps limit to items.length when items < limit", async () => {
    const seen: number[] = []
    await processMessagesConcurrently([1, 2], 100, async (n) => {
      seen.push(n)
    })
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2])
  })

  it("propagates the first handler rejection", async () => {
    await expect(
      processMessagesConcurrently([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom")
      })
    ).rejects.toThrow("boom")
  })
})
