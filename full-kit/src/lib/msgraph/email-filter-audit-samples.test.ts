import { describe, expect, it } from "vitest"

import type { EmailFilterAuditSampleInput } from "./email-filter-audit-samples"

import {
  buildEmailFilterAuditSampleCsv,
  buildEmailFilterAuditSampleReport,
} from "./email-filter-audit-samples"

function audit(
  input: Partial<EmailFilterAuditSampleInput> & {
    id: string
    riskFlags?: string[]
    rescueFlags?: string[]
  }
): EmailFilterAuditSampleInput {
  return {
    runId: "run-1",
    communicationId: input.communicationId ?? input.id,
    externalMessageId: input.externalMessageId ?? input.id,
    ruleId: input.ruleId ?? "classification-safety-default",
    classification: input.classification ?? "noise",
    bodyDecision: input.bodyDecision ?? "fetch_body",
    disposition: input.disposition ?? "observed",
    evidenceSnapshot: input.evidenceSnapshot ?? {
      subject: `Subject ${input.id}`,
      date: "2026-04-20T00:00:00.000Z",
      from: { address: `${input.id}@example.com` },
      storedClassification: input.classification ?? "noise",
      currentClassification: input.classification ?? "noise",
    },
    createdAt: input.createdAt ?? new Date("2026-04-26T00:00:00.000Z"),
    ...input,
    riskFlags: input.riskFlags ?? [],
    rescueFlags: input.rescueFlags ?? [],
  }
}

describe("email filter audit sample reports", () => {
  it("groups high-risk review candidates without exposing body content", () => {
    const report = buildEmailFilterAuditSampleReport(
      [
        audit({
          id: "rescued",
          rescueFlags: ["known_contact"],
        }),
        audit({
          id: "changed",
          evidenceSnapshot: {
            subject: "Broker update",
            body: "secret raw body must not be exported",
            date: "2026-04-20T00:00:00.000Z",
            from: { address: "broker@srsrealestatepartners.com" },
            storedClassification: "noise",
            currentClassification: "uncertain",
          },
        }),
        audit({
          id: "lead",
          classification: "signal",
          rescueFlags: ["platform_lead_subject"],
        }),
        audit({
          id: "domain",
          ruleId: "layer-b-domain-drop",
          riskFlags: ["mixed_cre_broker_domain"],
        }),
      ],
      {
        generatedAt: new Date("2026-04-26T00:00:00.000Z"),
        perBucketLimit: 10,
      }
    )

    expect(report.scannedAuditRows).toBe(4)
    expect(report.generatedAt).toBe("2026-04-26T00:00:00.000Z")
    expect(
      report.buckets.find((bucket) => bucket.key === "rescued_noise")
        ?.totalCandidates
    ).toBe(1)
    expect(
      report.buckets.find(
        (bucket) => bucket.key === "historical_noise_now_uncertain"
      )?.samples[0]
    ).toMatchObject({
      subject: "Broker update",
      senderDomain: "srsrealestatepartners.com",
      storedClassification: "noise",
      currentClassification: "uncertain",
    })
    expect(
      report.buckets.find((bucket) => bucket.key === "platform_lead_subject")
        ?.totalCandidates
    ).toBe(1)
    expect(
      report.buckets.find((bucket) => bucket.key === "system_keep_examples")
        ?.totalCandidates
    ).toBeGreaterThan(0)
    expect(JSON.stringify(report)).not.toContain("secret raw body")
  })

  it("limits bucket samples evenly across candidate lists", () => {
    const report = buildEmailFilterAuditSampleReport(
      Array.from({ length: 5 }, (_, index) =>
        audit({
          id: `row-${index}`,
          ruleId: "layer-b-sender-drop",
        })
      ),
      { perBucketLimit: 3 }
    )

    const senderBucket = report.buckets.find(
      (bucket) => bucket.key === "sender_drop_noise"
    )
    expect(senderBucket?.totalCandidates).toBe(5)
    expect(senderBucket?.samples.map((sample) => sample.auditId)).toEqual([
      "row-0",
      "row-2",
      "row-4",
    ])
  })

  it("recommends CRE leads and replied/deal emails as keep without making Matt review hundreds", () => {
    const report = buildEmailFilterAuditSampleReport(
      [
        audit({
          id: "lead",
          classification: "signal",
          rescueFlags: ["platform_lead_subject"],
          evidenceSnapshot: {
            subject: "LoopNet Lead for 123 Main Street",
            from: { address: "leads@loopnet.com" },
            storedClassification: "signal",
            currentClassification: "signal",
          },
        }),
        audit({
          id: "reply",
          rescueFlags: ["matt_replied_before", "deal_or_document_terms"],
          evidenceSnapshot: {
            subject: "RE: LOI for warehouse lease",
            from: { address: "broker@jll.com" },
            storedClassification: "noise",
            currentClassification: "uncertain",
          },
        }),
        ...Array.from({ length: 40 }, (_, index) =>
          audit({
            id: `ambiguous-${index}`,
            riskFlags: ["list_unsubscribe"],
            rescueFlags: ["direct_to_matt"],
            evidenceSnapshot: {
              subject: `Market update ${index}`,
              from: { address: `sender-${index}@example.com` },
              storedClassification: "noise",
              currentClassification: "noise",
            },
          })
        ),
      ],
      { reviewPackLimit: 12 }
    )

    const keepBucket = report.buckets.find(
      (bucket) => bucket.key === "system_keep_examples"
    )
    const reviewBucket = report.buckets.find(
      (bucket) => bucket.key === "matt_review_pack"
    )

    expect(keepBucket?.samples.map((sample) => sample.auditId)).toContain(
      "lead"
    )
    expect(keepBucket?.samples.map((sample) => sample.auditId)).toContain(
      "reply"
    )
    expect(reviewBucket?.samples.length).toBeLessThanOrEqual(12)
  })

  it("keeps Matt's decision pack focused on external inbound rows", () => {
    const report = buildEmailFilterAuditSampleReport(
      [
        audit({
          id: "outbound",
          rescueFlags: ["known_contact", "nai_internal"],
          evidenceSnapshot: {
            subject: "Re: 455 Moore Lane",
            direction: "outbound",
            from: { address: "mrobertson@naibusinessproperties.com" },
            storedClassification: "signal",
            currentClassification: "signal",
          },
        }),
        audit({
          id: "internal",
          rescueFlags: ["nai_internal"],
          evidenceSnapshot: {
            subject: "Internal broker update",
            direction: "inbound",
            from: { address: "broker@naibusinessproperties.com" },
            storedClassification: "signal",
            currentClassification: "signal",
          },
        }),
        audit({
          id: "external",
          classification: "uncertain",
          riskFlags: ["list_unsubscribe"],
          rescueFlags: ["direct_to_matt"],
          evidenceSnapshot: {
            subject: "Following up",
            direction: "inbound",
            from: { address: "broker@jll.com" },
            storedClassification: "uncertain",
            currentClassification: "uncertain",
          },
        }),
      ],
      { reviewPackLimit: 15 }
    )

    const reviewIds =
      report.buckets
        .find((bucket) => bucket.key === "matt_review_pack")
        ?.samples.map((sample) => sample.auditId) ?? []
    const keepIds =
      report.buckets
        .find((bucket) => bucket.key === "system_keep_examples")
        ?.samples.map((sample) => sample.auditId) ?? []

    expect(keepIds).toContain("external")
    expect(reviewIds).not.toContain("outbound")
    expect(reviewIds).not.toContain("internal")
  })

  it("recommends Matt-engaged and outbound thread context as keep", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "matt-replied",
        classification: "noise",
        riskFlags: ["list_unsubscribe"],
        rescueFlags: ["matt_replied_before"],
        evidenceSnapshot: {
          subject: "Random looking thread Matt replied to",
          direction: "inbound",
          from: { address: "person@example.com" },
          storedClassification: "noise",
          currentClassification: "signal",
        },
      }),
      audit({
        id: "sent-context",
        classification: "signal",
        evidenceSnapshot: {
          subject: "FW: Documents for 421 N 24th",
          direction: "outbound",
          from: { address: "mrobertson@naibusinessproperties.com" },
          storedClassification: "signal",
          currentClassification: "signal",
        },
      }),
      audit({
        id: "known-direct",
        classification: "uncertain",
        rescueFlags: ["known_contact", "direct_to_matt"],
        evidenceSnapshot: {
          subject: "Re: 421 N 24th",
          direction: "inbound",
          from: { address: "contact@example.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
    ])

    const keepIds =
      report.buckets
        .find((bucket) => bucket.key === "system_keep_examples")
        ?.samples.map((sample) => sample.auditId) ?? []
    const reviewIds =
      report.buckets
        .find((bucket) => bucket.key === "matt_review_pack")
        ?.samples.map((sample) => sample.auditId) ?? []

    expect(keepIds).toEqual(
      expect.arrayContaining(["matt-replied", "sent-context", "known-direct"])
    )
    expect(reviewIds).not.toEqual(
      expect.arrayContaining(["matt-replied", "known-direct"])
    )
  })

  it("keeps reply/forward/accepted thread subjects but still rejects obvious listing blasts", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "reply-thread",
        classification: "uncertain",
        riskFlags: ["mixed_cre_broker_domain"],
        rescueFlags: ["large_cre_broker", "direct_to_matt"],
        evidenceSnapshot: {
          subject: "RE: Billings, MT Site - TPA/Tellworks Final Coordination",
          direction: "inbound",
          from: { address: "broker@cbre.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "accepted-meeting",
        classification: "uncertain",
        riskFlags: ["mixed_cre_broker_domain"],
        rescueFlags: ["large_cre_broker", "direct_to_matt"],
        evidenceSnapshot: {
          subject: "Accepted: LL/Tellworks Discussion for 3218 S Frontage Rd",
          direction: "inbound",
          from: { address: "broker@cbre.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "nnn-blast",
        classification: "noise",
        rescueFlags: ["direct_to_matt", "small_recipient_list"],
        evidenceSnapshot: {
          subject:
            "KinderCare in Colorado Springs CO | New 15 Yr Corporate NNN w/ Increases",
          direction: "inbound",
          from: { address: "nationalnetlease@srsrealestatepartners.com" },
          storedClassification: "noise",
          currentClassification: "noise",
        },
      }),
      audit({
        id: "specific-address",
        classification: "uncertain",
        rescueFlags: ["direct_to_matt", "small_recipient_list"],
        evidenceSnapshot: {
          subject: "4015 1st Avenue South",
          direction: "inbound",
          from: { address: "broker@marcusmillichap.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "national-retail-blast",
        classification: "noise",
        rescueFlags: ["direct_to_matt", "small_recipient_list"],
        evidenceSnapshot: {
          subject:
            "Dollar General | 17-year Operating History | Austin MSA | Dense In-Fill Trade Area",
          direction: "inbound",
          from: { address: "nationalnetlease@srsrealestatepartners.com" },
          storedClassification: "noise",
          currentClassification: "noise",
        },
      }),
      audit({
        id: "large-cre-direct",
        classification: "uncertain",
        riskFlags: ["mixed_cre_broker_domain"],
        rescueFlags: ["large_cre_broker", "direct_to_matt"],
        evidenceSnapshot: {
          subject: "Survey request: 15-20k SF in Billings",
          direction: "inbound",
          from: { address: "broker@jll.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
    ])

    const keepIds =
      report.buckets
        .find((bucket) => bucket.key === "system_keep_examples")
        ?.samples.map((sample) => sample.auditId) ?? []
    const noiseIds =
      report.buckets
        .find((bucket) => bucket.key === "system_noise_examples")
        ?.samples.map((sample) => sample.auditId) ?? []

    expect(keepIds).toEqual(
      expect.arrayContaining([
        "reply-thread",
        "accepted-meeting",
        "specific-address",
        "large-cre-direct",
      ])
    )
    expect(noiseIds).toContain("nnn-blast")
    expect(noiseIds).toContain("national-retail-blast")
  })

  it("uses Matt feedback to keep direct personal/property review items and drop no-action patterns", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "personal-school",
        classification: "uncertain",
        rescueFlags: ["direct_to_matt", "small_recipient_list"],
        evidenceSnapshot: {
          subject: "[Grace Montessori Academy] 6 post(s) about McCoy",
          direction: "inbound",
          from: { address: "notifications@transparentclassroom.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "owned-property",
        classification: "uncertain",
        rescueFlags: ["direct_to_matt", "small_recipient_list"],
        evidenceSnapshot: {
          subject: "High Water usage at Bin119",
          direction: "inbound",
          from: { address: "utility@example.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "direct-review",
        classification: "uncertain",
        rescueFlags: ["direct_to_matt", "small_recipient_list"],
        evidenceSnapshot: {
          subject: "Canceled: Billings USBank",
          direction: "inbound",
          from: { address: "sender@example.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "top-producer-no-action",
        classification: "uncertain",
        rescueFlags: ["large_cre_broker", "has_attachments"],
        evidenceSnapshot: {
          subject: "Top Producer Details",
          direction: "inbound",
          from: { address: "lfierro@naiglobal.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "laurel-bov-no-action",
        classification: "uncertain",
        rescueFlags: ["large_cre_broker", "has_attachments"],
        evidenceSnapshot: {
          subject: "Laurel, MT BOV's + NAI Billings Introduction",
          direction: "inbound",
          from: { address: "reed.lindner@jll.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
    ])

    const keepSamples =
      report.buckets.find((bucket) => bucket.key === "system_keep_examples")
        ?.samples ?? []
    const noiseIds =
      report.buckets
        .find((bucket) => bucket.key === "system_noise_examples")
        ?.samples.map((sample) => sample.auditId) ?? []

    expect(keepSamples.map((sample) => sample.auditId)).toEqual(
      expect.arrayContaining([
        "personal-school",
        "owned-property",
        "direct-review",
      ])
    )
    expect(
      keepSamples.find((sample) => sample.auditId === "personal-school")
    ).toMatchObject({
      suggestedCategory: "personal",
      likelyTodo:
        "Create a personal review item for Matt; classify under personal.",
    })
    expect(noiseIds).toEqual(
      expect.arrayContaining(["top-producer-no-action", "laurel-bov-no-action"])
    )
  })

  it("uses Matt feedback to keep only HGC from the latest informational review pack", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "declined-marketing",
        classification: "uncertain",
        riskFlags: ["mixed_cre_broker_domain"],
        rescueFlags: ["large_cre_broker"],
        evidenceSnapshot: {
          subject: "Declined: [External]  Billings Marketing Bi-Weekly",
          direction: "inbound",
          from: { address: "wills.allen@nmrk.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "mailer-daemon",
        classification: "uncertain",
        evidenceSnapshot: {
          subject: "Undeliverable: Testing",
          direction: "inbound",
          from: { address: "mailer-daemon@perfora.net" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "hgc-board",
        classification: "uncertain",
        evidenceSnapshot: {
          subject: "HGC Board Packet and Financials",
          direction: "inbound",
          from: { address: "bryce@hilandsgolfclub.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "sior-informational",
        classification: "uncertain",
        evidenceSnapshot: {
          subject: "SIOR Spring Event - Ambassador Program",
          direction: "inbound",
          from: { address: "ccollins@sior.com" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
      audit({
        id: "breach-noise",
        classification: "uncertain",
        evidenceSnapshot: {
          subject:
            "Notice of Breach of Confidentiality and Demand to Cease Communications",
          direction: "inbound",
          from: { address: "dreidelbach@jobconnection.org" },
          storedClassification: "uncertain",
          currentClassification: "uncertain",
        },
      }),
    ])

    const keepIds =
      report.buckets
        .find((bucket) => bucket.key === "system_keep_examples")
        ?.samples.map((sample) => sample.auditId) ?? []
    const noiseIds =
      report.buckets
        .find((bucket) => bucket.key === "system_noise_examples")
        ?.samples.map((sample) => sample.auditId) ?? []
    const reviewIds =
      report.buckets
        .find((bucket) => bucket.key === "matt_review_pack")
        ?.samples.map((sample) => sample.auditId) ?? []

    expect(keepIds).toContain("hgc-board")
    expect(
      report.buckets
        .flatMap((bucket) => bucket.samples)
        .find((sample) => sample.auditId === "hgc-board")
    ).toMatchObject({
      suggestedCategory: "personal",
      likelyTodo:
        "Create a personal review item for Matt; classify under personal.",
    })
    expect(noiseIds).toEqual(
      expect.arrayContaining([
        "declined-marketing",
        "mailer-daemon",
        "sior-informational",
        "breach-noise",
      ])
    )
    expect(reviewIds).toHaveLength(0)
  })

  it("recommends obvious marketing/list noise as noise", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "noise",
        riskFlags: ["list_unsubscribe", "automated_local_part"],
        evidenceSnapshot: {
          subject: "Daily digest webinar discount sale ends",
          from: { address: "newsletter@example.com" },
          storedClassification: "noise",
          currentClassification: "noise",
        },
      }),
    ])

    expect(
      report.buckets.find((bucket) => bucket.key === "system_noise_examples")
        ?.samples[0]
    ).toMatchObject({
      auditId: "noise",
      systemRecommendation: "NOISE",
    })
  })

  it("does not treat listing blasts as leads just because they mention property terms", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "listing-blast",
        riskFlags: ["noise_sender"],
        rescueFlags: ["direct_to_matt", "deal_or_document_terms"],
        evidenceSnapshot: {
          subject:
            "Workplace Wednesday | Featured Office Listings for Lease | Nationwide",
          direction: "inbound",
          from: { address: "emails@pro.crexi.com" },
          storedClassification: "noise",
          currentClassification: "noise",
        },
      }),
    ])

    const noise = report.buckets.find(
      (bucket) => bucket.key === "system_noise_examples"
    )
    expect(noise?.samples[0]).toMatchObject({
      auditId: "listing-blast",
      systemRecommendation: "NOISE",
    })
  })

  it("does not ask Matt to review noise-classified listing blasts with only weak rescue flags", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "weak-rescue-listing",
        riskFlags: ["noise_domain"],
        rescueFlags: ["direct_to_matt", "deal_or_document_terms"],
        evidenceSnapshot: {
          subject: "Your Listing on BizBuySell",
          direction: "inbound",
          from: { address: "news@bizbuysell.com" },
          storedClassification: "noise",
          currentClassification: "noise",
        },
      }),
    ])

    const reviewIds =
      report.buckets
        .find((bucket) => bucket.key === "matt_review_pack")
        ?.samples.map((sample) => sample.auditId) ?? []
    expect(reviewIds).not.toContain("weak-rescue-listing")
    expect(
      report.buckets.find((bucket) => bucket.key === "system_noise_examples")
        ?.samples[0]
    ).toMatchObject({
      auditId: "weak-rescue-listing",
      systemRecommendation: "NOISE",
    })
  })

  it("does not treat known-contact association newsletters as Matt review items", () => {
    const report = buildEmailFilterAuditSampleReport([
      audit({
        id: "bar-newsletter",
        riskFlags: ["list_unsubscribe"],
        rescueFlags: ["known_contact", "direct_to_matt"],
        ruleId: "layer-b-unsubscribe-header",
        evidenceSnapshot: {
          subject: "The BAR Continuing Education Roadshow is Heading Your Way!",
          direction: "inbound",
          from: { address: "boardoffice@billings.org" },
          storedClassification: "noise",
          currentClassification: "noise",
        },
      }),
    ])

    const reviewIds =
      report.buckets
        .find((bucket) => bucket.key === "matt_review_pack")
        ?.samples.map((sample) => sample.auditId) ?? []
    expect(reviewIds).not.toContain("bar-newsletter")
    expect(
      report.buckets.find((bucket) => bucket.key === "system_noise_examples")
        ?.samples[0]
    ).toMatchObject({
      auditId: "bar-newsletter",
      systemRecommendation: "NOISE",
    })
  })

  it("deduplicates repeated threads in the small keep example pack", () => {
    const report = buildEmailFilterAuditSampleReport(
      [
        audit({
          id: "thread-original",
          classification: "uncertain",
          rescueFlags: ["known_contact", "direct_to_matt"],
          evidenceSnapshot: {
            subject: "Iowa Connection",
            direction: "inbound",
            from: { address: "broker@example.com" },
            storedClassification: "uncertain",
            currentClassification: "uncertain",
          },
        }),
        audit({
          id: "thread-reply",
          classification: "uncertain",
          rescueFlags: ["known_contact", "direct_to_matt"],
          evidenceSnapshot: {
            subject: "Re: [EXT] Iowa Connection",
            direction: "inbound",
            from: { address: "broker@example.com" },
            storedClassification: "uncertain",
            currentClassification: "uncertain",
          },
        }),
      ],
      { reviewPackLimit: 10 }
    )

    expect(
      report.buckets.find((bucket) => bucket.key === "system_keep_examples")
        ?.samples
    ).toHaveLength(1)
  })

  it("exports a Matt-friendly CSV with decision columns and no body content", () => {
    const report = buildEmailFilterAuditSampleReport(
      [
        audit({
          id: "changed",
          evidenceSnapshot: {
            subject: 'Broker "update"',
            body: "secret raw body must not be exported",
            date: "2026-04-20T00:00:00.000Z",
            from: { address: "broker@srsrealestatepartners.com" },
            storedClassification: "noise",
            currentClassification: "uncertain",
          },
        }),
      ],
      { perBucketLimit: 1 }
    )

    const csv = buildEmailFilterAuditSampleCsv(report)

    expect(csv.split("\r\n")[0]).toContain("matt_decision")
    expect(csv.split("\r\n")[0]).toContain("matt_notes")
    expect(csv.split("\r\n")[0]).toContain("system_recommendation")
    expect(csv.split("\r\n")[0]).toContain("suggested_category")
    expect(csv).toContain('Broker ""update""')
    expect(csv).toContain("broker/deal/revenue language")
    expect(csv).not.toContain("secret raw body")
  })
})
