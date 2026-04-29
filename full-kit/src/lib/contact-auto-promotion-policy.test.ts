import { describe, expect, it } from "vitest"

import {
  evaluateContactAutoPromotion,
  hasRealAttachmentEvidence,
  readContactAutoPromotionMode,
} from "./contact-auto-promotion-policy"

const base = {
  classification: "signal",
  source: "known-counterparty",
  direction: "inbound" as const,
  normalizedEmail: "tenant@example.com",
  displayName: "Tenant Prospect",
  contactMatches: [],
  currentCommunicationId: "comm-1",
}

describe("evaluateContactAutoPromotion", () => {
  it("fails closed to dry-run when auto-promotion mode is unset or invalid", () => {
    expect(readContactAutoPromotionMode(undefined)).toBe("dry_run")
    expect(readContactAutoPromotionMode("surprise")).toBe("dry_run")
    expect(readContactAutoPromotionMode("write")).toBe("write")
  })

  it("auto-links exactly one active contact email match", () => {
    expect(
      evaluateContactAutoPromotion({
        ...base,
        contactMatches: [{ id: "contact-1", archivedAt: null }],
      })
    ).toMatchObject({
      decision: "auto_link_existing",
      matchedContactId: "contact-1",
      reasonCodes: ["single_existing_contact_email_match"],
    })
  })

  it("does not pick a winner for duplicate contact email matches", () => {
    expect(
      evaluateContactAutoPromotion({
        ...base,
        contactMatches: [
          { id: "contact-1", archivedAt: null },
          { id: "contact-2", archivedAt: null },
        ],
      })
    ).toMatchObject({
      decision: "review_required",
      reasonCodes: ["duplicate_contact_email"],
    })
  })

  it("auto-creates for inbound real attachment plus Matt reply", () => {
    const result = evaluateContactAutoPromotion({
      ...base,
      currentHasRealAttachment: true,
      mattRepliedBefore: true,
      materialCommunicationCount: 2,
    })

    expect(result.decision).toBe("auto_create_contact")
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining([
        "inbound_non_inline_attachment_plus_matt_reply",
        "matt_replied_or_direct_outbound",
      ])
    )
  })

  it("keeps one-off unknown senders in review", () => {
    expect(evaluateContactAutoPromotion(base)).toMatchObject({
      decision: "review_required",
      reasonCodes: ["sender_display_name"],
    })
  })

  it("blocks platform and no-reply senders", () => {
    expect(
      evaluateContactAutoPromotion({
        ...base,
        source: "buildout-event",
        normalizedEmail: "support@buildout.com",
      })
    ).toMatchObject({
      decision: "blocked",
      blockedReasons: expect.arrayContaining([
        "platform_source:buildout-event",
        "automation_or_platform_address",
      ]),
    })
  })
})

describe("hasRealAttachmentEvidence", () => {
  it("does not count inline-only attachments", () => {
    expect(
      hasRealAttachmentEvidence({
        attachments: [{ name: "image001.png", isInline: true }],
        attachmentFetch: { status: "success", nonInlineCount: 0 },
      })
    ).toBe(false)
  })

  it("uses non-inline fetch count when present", () => {
    expect(
      hasRealAttachmentEvidence({
        attachments: [],
        attachmentFetch: { status: "success", nonInlineCount: 1 },
      })
    ).toBe(true)
  })
})
