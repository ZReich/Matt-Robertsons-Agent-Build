import { beforeEach, describe, expect, it, vi } from "vitest"

import { generatePendingReply } from "@/lib/ai/auto-reply"
import { sendMailAsMatt } from "@/lib/msgraph/send-mail"
import { db } from "@/lib/prisma"
import { getAutomationSettings } from "@/lib/system-state/automation-settings"

import { maybeFireAutoReplyForApprovedLead } from "./contact-promotion-auto-reply"

vi.mock("@/lib/prisma", () => ({
  db: {
    communication: {
      findUnique: vi.fn(),
    },
    property: {
      findFirst: vi.fn(),
    },
    pendingReply: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/ai/auto-reply", () => ({
  generatePendingReply: vi.fn(),
}))

vi.mock("@/lib/system-state/automation-settings", () => ({
  getAutomationSettings: vi.fn(),
  DEFAULT_AUTOMATION_SETTINGS: {
    autoSendNewLeadReplies: false,
    autoSendDailyMatchReplies: false,
    autoMatchScoreThreshold: 80,
    dailyMatchPerContactCap: 2,
  },
}))

vi.mock("@/lib/msgraph/send-mail", () => ({
  sendMailAsMatt: vi.fn(),
}))

const dbAny = db as unknown as {
  communication: { findUnique: ReturnType<typeof vi.fn> }
  property: { findFirst: ReturnType<typeof vi.fn> }
  pendingReply: {
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

const generateMock = generatePendingReply as unknown as ReturnType<typeof vi.fn>
const sendMock = sendMailAsMatt as unknown as ReturnType<typeof vi.fn>
const settingsMock = getAutomationSettings as unknown as ReturnType<
  typeof vi.fn
>

const DEFAULT_SETTINGS = {
  autoSendNewLeadReplies: false,
  autoSendDailyMatchReplies: false,
  autoMatchScoreThreshold: 80,
  dailyMatchPerContactCap: 2,
}

function commRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "comm-1",
    subject: "LoopNet Lead for 303 N Broadway",
    body: "303 N Broadway | Billings, MT 59101\nSome inquiry body.",
    metadata: {
      source: "platform-lead",
      extracted: { propertyKey: "303 n broadway billings mt 59101" },
    },
    ...overrides,
  }
}

function propertyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prop-1",
    propertyKey: "303 n broadway billings mt 59101",
    address: "303 N Broadway",
    city: "Billings",
    state: "MT",
    archivedAt: null,
    ...overrides,
  }
}

describe("maybeFireAutoReplyForApprovedLead", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsMock.mockResolvedValue(DEFAULT_SETTINGS)
  })

  it("skips when communication has no propertyKey and extractors find none", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        subject: "Hello there",
        body: "no addresses here",
        metadata: { source: "manual" },
      })
    )

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({ status: "skipped", reason: "no-property-key" })
    expect(dbAny.property.findFirst).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("skips when propertyKey present but no Property in catalog", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.property.findFirst.mockResolvedValue(null)

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({ status: "skipped", reason: "no-property-match" })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("skips when sensitive content detected on inbound communication", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        body: "Please send wire transfer instructions ASAP. Routing number 123456789.",
      })
    )

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({ status: "skipped", reason: "sensitive-content" })
    expect(dbAny.property.findFirst).not.toHaveBeenCalled()
  })

  it("skips when a PendingReply already exists for this trigger/contact/property", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.property.findFirst.mockResolvedValue(propertyRow())
    dbAny.pendingReply.findFirst.mockResolvedValue({ id: "pr-existing" })

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({
      status: "skipped",
      reason: "duplicate-pending-reply",
    })
    expect(generateMock).not.toHaveBeenCalled()
  })

  it("happy path persists a PendingReply (auto-send off)", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.property.findFirst.mockResolvedValue(propertyRow())
    dbAny.pendingReply.findFirst.mockResolvedValue(null)
    generateMock.mockResolvedValue({
      ok: true,
      pendingReplyId: "pr-1",
      draft: {
        subject: "Re: 303 N Broadway",
        body: "Hi Dana, thanks for the inquiry...",
        reasoning: "warm reply",
        modelUsed: "deepseek-chat",
        suggestedProperties: [],
      },
    })

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({
      status: "fired",
      pendingReplyId: "pr-1",
      sent: false,
    })
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerCommunicationId: "comm-1",
        contactId: "contact-1",
        propertyId: "prop-1",
        outreachKind: "inbound_inquiry",
        persist: true,
      })
    )
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("auto-sends when autoSendNewLeadReplies is true and send succeeds", async () => {
    settingsMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      autoSendNewLeadReplies: true,
    })
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.property.findFirst.mockResolvedValue(propertyRow())
    dbAny.pendingReply.findFirst.mockResolvedValue(null)
    generateMock.mockResolvedValue({
      ok: true,
      pendingReplyId: "pr-1",
      draft: {
        subject: "Re: 303 N Broadway",
        body: "Hi Dana, ...",
        reasoning: "",
        modelUsed: "deepseek-chat",
        suggestedProperties: [],
      },
    })
    sendMock.mockResolvedValue({ ok: true, immediateMessageId: null })
    dbAny.pendingReply.update.mockResolvedValue({})

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({
      status: "fired",
      pendingReplyId: "pr-1",
      sent: true,
    })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Re: 303 N Broadway",
        toRecipients: [{ address: "dana@example.com", name: "Dana Lead" }],
      })
    )
    expect(dbAny.pendingReply.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pr-1" },
        data: expect.objectContaining({
          status: "approved",
          approvedBy: "auto-send-new-lead-reply",
        }),
      })
    )
  })

  it("auto-send failure leaves PendingReply as draft", async () => {
    settingsMock.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      autoSendNewLeadReplies: true,
    })
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.property.findFirst.mockResolvedValue(propertyRow())
    dbAny.pendingReply.findFirst.mockResolvedValue(null)
    generateMock.mockResolvedValue({
      ok: true,
      pendingReplyId: "pr-1",
      draft: {
        subject: "Re: 303 N Broadway",
        body: "Hi Dana, ...",
        reasoning: "",
        modelUsed: "deepseek-chat",
        suggestedProperties: [],
      },
    })
    sendMock.mockResolvedValue({
      ok: false,
      reason: "permission_denied",
      details: "Mail.Send not granted",
    })

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({
      status: "fired",
      pendingReplyId: "pr-1",
      sent: false,
    })
    expect(dbAny.pendingReply.update).not.toHaveBeenCalled()
  })

  it("returns auto-reply-failed when generatePendingReply skips", async () => {
    dbAny.communication.findUnique.mockResolvedValue(commRow())
    dbAny.property.findFirst.mockResolvedValue(propertyRow())
    dbAny.pendingReply.findFirst.mockResolvedValue(null)
    generateMock.mockResolvedValue({
      ok: false,
      reason: "provider_error",
      details: "deepseek 500",
    })

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result).toEqual({
      status: "skipped",
      reason: "auto-reply-failed",
    })
  })

  it("catches thrown errors and surfaces 'errored'", async () => {
    dbAny.communication.findUnique.mockRejectedValue(new Error("db down"))

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result.status).toBe("errored")
    if (result.status === "errored") {
      expect(result.error).toContain("db down")
    }
  })

  it("falls back to extractor re-run when metadata.extracted.propertyKey is absent", async () => {
    dbAny.communication.findUnique.mockResolvedValue(
      commRow({
        metadata: { source: "platform-lead-loopnet" },
      })
    )
    dbAny.property.findFirst.mockResolvedValue(propertyRow())
    dbAny.pendingReply.findFirst.mockResolvedValue(null)
    generateMock.mockResolvedValue({
      ok: true,
      pendingReplyId: "pr-1",
      draft: {
        subject: "Re: 303 N Broadway",
        body: "Hi Dana, ...",
        reasoning: "",
        modelUsed: "deepseek-chat",
        suggestedProperties: [],
      },
    })

    const result = await maybeFireAutoReplyForApprovedLead({
      communicationId: "comm-1",
      contactId: "contact-1",
      contactEmail: "dana@example.com",
      contactName: "Dana Lead",
    })

    expect(result.status).toBe("fired")
    // The extractor should produce a propertyKey from the LoopNet body
    // ("303 N Broadway | Billings, MT 59101"), and we look it up.
    expect(dbAny.property.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          propertyKey: expect.any(String),
          archivedAt: null,
        }),
      })
    )
  })
})
