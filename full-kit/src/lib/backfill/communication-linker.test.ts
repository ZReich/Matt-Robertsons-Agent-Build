import { describe, expect, it } from "vitest"

import {
  filterOutboundBusinessRecipients,
  readCommunicationParties,
  readOutboundFilterConfig,
  runCommunicationLinkBackfill,
} from "./communication-linker"

describe("communication-linker helpers", () => {
  it("reads current Graph-backed metadata recipient shape", () => {
    const parties = readCommunicationParties({
      from: {
        address: "Sender@Example.com ",
        displayName: "Sender Person",
        isInternal: false,
      },
      toRecipients: [
        { emailAddress: { address: " Client@Example.com", name: "Client" } },
      ],
      ccRecipients: [
        { emailAddress: { address: "Broker@Example.com", name: "Broker" } },
      ],
      conversationId: "conversation-1",
      source: "layer-c",
    })

    expect(parties).toEqual({
      from: { address: "sender@example.com", name: "Sender Person" },
      to: [{ address: "client@example.com", name: "Client" }],
      cc: [{ address: "broker@example.com", name: "Broker" }],
      conversationId: "conversation-1",
      source: "layer-c",
    })
  })

  it("tolerates defensive legacy recipient shapes", () => {
    const parties = readCommunicationParties({
      sender: { emailAddress: { address: "legacy@example.com" } },
      to: [{ address: "to@example.com" }],
      cc: [{ email: "cc@example.com" }],
    })

    expect(parties.from?.address).toBe("legacy@example.com")
    expect(parties.to.map((p) => p.address)).toEqual(["to@example.com"])
    expect(parties.cc.map((p) => p.address)).toEqual(["cc@example.com"])
  })

  it("filters outbound self, internal, and system recipients", () => {
    const filtered = filterOutboundBusinessRecipients(
      [
        { address: "matt@example.com" },
        { address: "broker@naipartners.com" },
        { address: "notifications@platform.com" },
        { address: "client@external.com" },
      ],
      {
        selfEmails: ["matt@example.com"],
        targetUpn: "mrobertson@example.com",
        internalDomains: ["naipartners.com"],
        systemEmailDenylist: ["notifications@", "no-reply@"],
        outboundIncludeInternal: false,
      }
    )

    expect(filtered).toEqual([{ address: "client@external.com" }])
  })

  it("can include internal recipients when explicitly configured", () => {
    const filtered = filterOutboundBusinessRecipients(
      [{ address: "broker@naipartners.com" }],
      {
        selfEmails: [],
        internalDomains: ["naipartners.com"],
        systemEmailDenylist: [],
        outboundIncludeInternal: true,
      }
    )

    expect(filtered).toEqual([{ address: "broker@naipartners.com" }])
  })

  it("loads outbound filter env defaults", () => {
    const config = readOutboundFilterConfig({
      EMAIL_BACKFILL_SELF_EMAILS: "Matt@Example.com, alias@example.com",
      MSGRAPH_TARGET_UPN: "target@example.com",
      EMAIL_BACKFILL_INTERNAL_DOMAINS: "naipartners.com",
      EMAIL_BACKFILL_OUTBOUND_INCLUDE_INTERNAL: "false",
    })

    expect(config.selfEmails).toEqual(["matt@example.com", "alias@example.com"])
    expect(config.targetUpn).toBe("target@example.com")
    expect(config.internalDomains).toEqual(["naipartners.com"])
    expect(config.outboundIncludeInternal).toBe(false)
    expect(config.systemEmailDenylist).toContain("no-reply@")
  })

  it("links a single active deal in the same dry-run pass for a newly linked contact", async () => {
    const client = {
      communication: {
        findMany: async () => [
          {
            id: "comm-1",
            metadata: { from: { address: "client@example.com" } },
            direction: "inbound",
            contactId: null,
            dealId: null,
            date: new Date("2026-04-25T12:00:00Z"),
          },
        ],
      },
      contact: {
        findMany: async () => [
          { id: "contact-1", email: "client@example.com", archivedAt: null },
        ],
      },
      deal: {
        findMany: async () => [
          {
            id: "deal-1",
            contactId: "contact-1",
            archivedAt: null,
            stage: "listing",
          },
        ],
      },
    }

    const result = await runCommunicationLinkBackfill({
      request: { dryRun: true, limit: 1, runId: "run-1" },
      // The helper only uses the mocked model methods above in dry-run mode.
      client: client as never,
    })

    expect(result.updatedContactId).toBe(1)
    expect(result.updatedDealId).toBe(1)
    expect(result.samples.linked.map((sample) => sample.strategy)).toEqual([
      "inbound_sender_exact_email",
      "single_active_deal_for_contact",
    ])
  })
})
