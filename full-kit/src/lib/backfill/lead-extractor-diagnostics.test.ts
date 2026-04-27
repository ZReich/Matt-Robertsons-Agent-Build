import { describe, expect, it } from "vitest"

import {
  detectLeadPlatform,
  runLeadExtractorDiagnostics,
} from "./lead-extractor-diagnostics"

describe("lead-extractor-diagnostics", () => {
  it("detects platform from source, sender domain, or subject", () => {
    expect(
      detectLeadPlatform({
        subject: "Random",
        metadata: { source: "crexi-lead" },
      })
    ).toBe("crexi")
    expect(
      detectLeadPlatform({
        subject: "LoopNet Lead for 303 N Broadway",
        metadata: { from: { address: "sender@example.com" } },
      })
    ).toBe("loopnet")
    expect(
      detectLeadPlatform({
        subject: "A new Lead has been added - US Bank Building",
        metadata: { from: { address: "support@buildout.com" } },
      })
    ).toBe("buildout")
  })

  it("returns null for non-platform rows", () => {
    expect(
      detectLeadPlatform({
        subject: "Meeting follow up",
        metadata: { from: { address: "client@example.com" } },
      })
    ).toBeNull()
  })

  it("distinguishes marking an existing non-client contact from creating a new one", async () => {
    const result = await runDiagnosticsWithContact({
      id: "contact-1",
      email: "dana@example.com",
      leadSource: null,
      leadStatus: null,
      _count: { deals: 0 },
    })

    expect(result.byOutcome).toMatchObject({
      would_mark_existing_contact_as_lead: 1,
    })
    expect(result.samples[0]?.wouldCreateOrUpdateContact).toBe(true)
  })

  it("distinguishes new, already-lead, and existing-client outcomes", async () => {
    await expect(runDiagnosticsWithContact(null)).resolves.toMatchObject({
      byOutcome: { would_create_contact_candidate: 1 },
    })
    await expect(
      runDiagnosticsWithContact({
        id: "contact-1",
        email: "dana@example.com",
        leadSource: "loopnet",
        leadStatus: "new",
        _count: { deals: 0 },
      })
    ).resolves.toMatchObject({
      byOutcome: { already_lead: 1 },
    })
    await expect(
      runDiagnosticsWithContact({
        id: "contact-1",
        email: "dana@example.com",
        leadSource: null,
        leadStatus: null,
        _count: { deals: 1 },
      })
    ).resolves.toMatchObject({
      byOutcome: { already_client_no_lead_status: 1 },
    })
  })

  it("covers extractor and classification diagnostic failure outcomes", async () => {
    await expect(
      runDiagnosticsWithContact(null, {
        subject: "Random Crexi update",
        body: "No lead fields here",
        metadata: {
          classification: "signal",
          source: "crexi-lead",
          from: { address: "emails@notifications.crexi.com" },
        },
      })
    ).resolves.toMatchObject({
      byOutcome: { platform_signal_but_extractor_null: 1 },
    })

    await expect(
      runDiagnosticsWithContact(null, {
        subject: "3 new leads found for West Park Promenade",
        body: "",
        metadata: {
          classification: "signal",
          source: "crexi-lead",
          from: { address: "emails@notifications.crexi.com" },
        },
      })
    ).resolves.toMatchObject({
      byOutcome: { extractor_has_no_inquirer_email: 1 },
    })

    await expect(
      runDiagnosticsWithContact(null, {
        metadata: {
          classification: "noise",
          from: { address: "leads@loopnet.com" },
        },
      })
    ).resolves.toMatchObject({
      byOutcome: { classified_noise_but_platform_candidate: 1 },
    })

    await expect(
      runDiagnosticsWithContact(null, {
        metadata: {
          classification: "uncertain",
          from: { address: "leads@loopnet.com" },
        },
      })
    ).resolves.toMatchObject({
      byOutcome: { classified_uncertain_but_platform_candidate: 1 },
    })

    await expect(
      runDiagnosticsWithContact(null, {
        subject: null,
        body: null,
        metadata: {
          classification: "signal",
          source: "crexi-lead",
        },
      })
    ).resolves.toMatchObject({
      byOutcome: { missing_body_or_metadata: 1 },
    })
  })
})

function diagnosticClient(contact: unknown, rowOverrides = {}) {
  return {
    communication: {
      findMany: async () => [
        {
          id: "comm-1",
          subject: "LoopNet Lead for 303 N Broadway",
          body: "Name: Dana Lead\nEmail: dana@example.com\nMessage: Interested",
          metadata: {
            classification: "signal",
            from: { address: "leads@loopnet.com" },
          },
          date: new Date("2026-04-25T12:00:00Z"),
          ...rowOverrides,
        },
      ],
    },
    contact: {
      findMany: async () => (contact ? [contact] : []),
    },
  }
}

function runDiagnosticsWithContact(contact: unknown, rowOverrides = {}) {
  return runLeadExtractorDiagnostics({
    request: { includeSamples: true, runId: "run-1" },
    client: diagnosticClient(contact, rowOverrides) as never,
  })
}
