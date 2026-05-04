import { beforeEach, describe, expect, it, vi } from "vitest"

import { ingestSingleBackfillMessage } from "./ingest-message"

vi.mock("@/lib/msgraph/emails", () => ({
  persistMessage: vi.fn().mockResolvedValue({
    inserted: true,
    contactCreated: false,
    leadContactId: null,
    leadCreated: false,
    communicationId: "comm-1",
    contactId: "c1",
  }),
}))

vi.mock("@/lib/msgraph/email-filter", () => ({
  classifyEmail: vi.fn().mockReturnValue({
    classification: "uncertain",
    source: "layer-c",
    tier1Rule: "tier2-default",
  }),
}))

const baseMessage = {
  id: "g1",
  receivedDateTime: "2026-04-15T10:00:00Z",
  from: { emailAddress: { address: "alice@buyer.com", name: "Alice" } },
}

const baseInput = {
  message: baseMessage as any,
  contactId: "c1",
  targetUpn: "mrobertson@naibusinessproperties.com",
}

describe("ingestSingleBackfillMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("classifies, persists, and returns ingest result", async () => {
    const { persistMessage } = await import("@/lib/msgraph/emails")
    ;(persistMessage as any).mockResolvedValueOnce({
      inserted: true,
      contactCreated: false,
      leadContactId: null,
      leadCreated: false,
      communicationId: "comm-1",
      contactId: "c1",
    })

    const result = await ingestSingleBackfillMessage(baseInput)

    expect(result.communicationId).toBe("comm-1")
    expect(result.deduped).toBe(false)
    expect(result.classification).toBe("uncertain")
  })

  it("returns deduped=true when persistMessage reports an existing message", async () => {
    const { persistMessage } = await import("@/lib/msgraph/emails")
    ;(persistMessage as any).mockResolvedValueOnce({
      inserted: false,
      contactCreated: false,
      leadContactId: null,
      leadCreated: false,
      communicationId: null,
      contactId: "c1",
    })

    const result = await ingestSingleBackfillMessage(baseInput)

    expect(result.deduped).toBe(true)
    expect(result.communicationId).toBeNull()
  })

  it("passes dealIdOverride and senderInContacts hint through to persistMessage", async () => {
    const { persistMessage } = await import("@/lib/msgraph/emails")

    await ingestSingleBackfillMessage({ ...baseInput, dealId: "deal-42" })

    expect(persistMessage).toHaveBeenCalledTimes(1)
    const call = (persistMessage as any).mock.calls[0][0]
    expect(call.dealIdOverride).toBe("deal-42")
    expect(call.contactId).toBe("c1")
    expect(call.hints.senderInContacts).toBe(true)
    expect(call.folder).toBe("inbox")
  })

  it("treats messages from targetUpn as outbound (sentitems folder)", async () => {
    const { persistMessage } = await import("@/lib/msgraph/emails")
    const { classifyEmail } = await import("@/lib/msgraph/email-filter")

    await ingestSingleBackfillMessage({
      ...baseInput,
      message: {
        ...baseMessage,
        from: {
          emailAddress: { address: "mrobertson@naibusinessproperties.com" },
        },
        sentDateTime: "2026-04-15T10:00:00Z",
      } as any,
    })

    const persistCall = (persistMessage as any).mock.calls[0][0]
    expect(persistCall.folder).toBe("sentitems")
    const classifyCall = (classifyEmail as any).mock.calls[0]
    expect(classifyCall[1].folder).toBe("sentitems")
  })

  it("defaults dealIdOverride to null when caller omits dealId", async () => {
    const { persistMessage } = await import("@/lib/msgraph/emails")

    await ingestSingleBackfillMessage(baseInput)

    const call = (persistMessage as any).mock.calls[0][0]
    expect(call.dealIdOverride).toBeNull()
  })
})
