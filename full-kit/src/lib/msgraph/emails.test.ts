import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { graphFetch } from "./client"
import { fetchEmailDelta, persistMessage } from "./emails"

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
      create: vi.fn(),
      update: vi.fn(),
    },
    scrubQueue: {
      create: vi.fn(),
    },
    communication: {
      count: vi.fn(),
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
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
    expect(initialOptions.headers.Prefer).toContain(
      'outlook.body-content-type="text"'
    )
    expect(initialOptions.headers.Prefer).toContain("odata.maxpagesize=100")
    expect(pages).toHaveLength(2)
    expect(pages[1].isFinal).toBe(true)
  })
})

describe("persistMessage scrub enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })

  it("enqueues signal communications inside the persist transaction", async () => {
    await persistMessage({
      message: {
        id: "graph-1",
        receivedDateTime: "2026-04-24T12:00:00.000Z",
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
      extracted: null,
      attachments: undefined,
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.scrubQueue.create).toHaveBeenCalledWith({
      data: { communicationId: "comm-1", status: "pending" },
    })
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
      extracted: null,
      attachments: undefined,
      contactId: null,
      leadContactId: null,
      leadCreated: false,
    })

    expect(db.scrubQueue.create).not.toHaveBeenCalled()
  })
})
