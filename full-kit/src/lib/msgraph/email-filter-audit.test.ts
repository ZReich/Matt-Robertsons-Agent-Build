import { describe, expect, it } from "vitest"

import { buildEmailFilterRunReport } from "./email-filter-audit"

describe("email filter audit reports", () => {
  it("counts classifications, body decisions, rule hits, risk flags, and rescue flags", () => {
    const report = buildEmailFilterRunReport([
      {
        classification: "noise",
        bodyDecision: "fetch_body",
        ruleId: "layer-b-unsubscribe-header",
        ruleVersion: 1,
        disposition: "observed",
        riskFlags: ["list_unsubscribe", "mixed_cre_broker_domain"],
        rescueFlags: ["direct_to_matt"],
      },
      {
        classification: "signal",
        bodyDecision: "fetch_body",
        ruleId: "matt-outbound",
        ruleVersion: 1,
        disposition: "fetched_body",
        riskFlags: [],
        rescueFlags: ["known_contact"],
      },
    ])

    expect(report).toMatchObject({
      messagesSeen: 2,
      classifications: { noise: 1, signal: 1 },
      bodyDecisions: { fetch_body: 2 },
      ruleHits: {
        "layer-b-unsubscribe-header@1": 1,
        "matt-outbound@1": 1,
      },
      riskFlags: {
        list_unsubscribe: 1,
        mixed_cre_broker_domain: 1,
      },
      rescueFlags: {
        direct_to_matt: 1,
        known_contact: 1,
      },
    })
  })
})
