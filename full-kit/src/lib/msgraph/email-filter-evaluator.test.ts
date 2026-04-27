import { describe, expect, it } from "vitest"

import type { EmailFilterRuleDefinition } from "./email-filter-rules"
import type {
  ClassificationResult,
  FilterContext,
  GraphEmailMessage,
} from "./email-types"

import {
  collectEmailRescueFlags,
  collectEmailRiskFlags,
  evaluateBodyFetchFailure,
  evaluateEmailAcquisition,
  evaluateStopGates,
} from "./email-filter-evaluator"

function context(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    folder: "inbox",
    targetUpn: "mrobertson@naibusinessproperties.com",
    normalizedSender: {
      address: "newsletter@cbre.com",
      displayName: "CBRE",
      isInternal: false,
      normalizationFailed: false,
    },
    hints: {
      senderInContacts: false,
      mattRepliedBefore: false,
      threadSize: 1,
      domainIsLargeCreBroker: true,
    },
    ...overrides,
  }
}

function message(
  overrides: Partial<GraphEmailMessage> = {}
): GraphEmailMessage {
  return {
    id: "m1",
    subject: "Industrial referral in Cheyenne",
    from: { emailAddress: { address: "newsletter@cbre.com" } },
    receivedDateTime: "2026-04-24T12:00:00Z",
    toRecipients: [
      { emailAddress: { address: "mrobertson@naibusinessproperties.com" } },
    ],
    internetMessageHeaders: [
      { name: "List-Unsubscribe", value: "<mailto:unsubscribe@example.com>" },
    ],
    bodyPreview: "Referral broker and tenant requirement",
    ...overrides,
  }
}

const noiseClassification: ClassificationResult = {
  classification: "noise",
  source: "layer-b-unsubscribe-header",
  tier1Rule: "list-unsubscribe",
}

function activeRule(): EmailFilterRuleDefinition {
  return {
    ruleId: "layer-b-unsubscribe-header",
    version: 99,
    name: "active test rule",
    source: "layer-b-unsubscribe-header",
    mode: "active",
    enabled: true,
    rolloutPercent: 100,
    owner: "test",
    rationale: "test",
    matchDefinition: {},
    evidenceRequired: {},
    rescueConditions: [],
    samplePolicy: {
      minReviewed: 200,
      percentIfFewerThan1000: 10,
      criticalFalseNegativesAllowed: 0,
    },
    promotionCriteria: {
      minMessagesOrDays: { messages: 2000, days: 14 },
      maxNonCriticalUncertainRate: 0.005,
      maxBodyFetchFailureRate: 0.02,
      requiresProductOwnerApproval: true,
      requiresReleaseLeadApproval: true,
      requiresPrivacySecurityApproval: true,
    },
    demotionPolicy: {
      demoteOnCriticalFalseNegative: true,
      demoteOnUnreviewedRuleChange: true,
    },
    safeSkipCapable: true,
  }
}

describe("email acquisition evaluator", () => {
  it("does not turn noise classification into safe_body_skip in observe mode", () => {
    const decision = evaluateEmailAcquisition(
      message(),
      context(),
      noiseClassification,
      { runMode: "observe" }
    )
    expect(decision.classification).toBe("noise")
    expect(decision.bodyDecision).toBe("fetch_body")
    expect(decision.disposition).toBe("observed")
  })

  it("routes quarantine mode noise to metadata_only_quarantine rather than safe skip", () => {
    const decision = evaluateEmailAcquisition(
      message(),
      context(),
      noiseClassification,
      { runMode: "quarantine_only" }
    )
    expect(decision.bodyDecision).toBe("metadata_only_quarantine")
    expect(decision.disposition).toBe("quarantined")
  })

  it("blocks List-Unsubscribe safe skip when rescue or mixed CRE flags exist", () => {
    const decision = evaluateEmailAcquisition(
      message(),
      context(),
      noiseClassification,
      { runMode: "active", rules: [activeRule()] }
    )
    expect(decision.bodyDecision).not.toBe("safe_body_skip")
    expect(decision.riskFlags).toContain("list_unsubscribe")
    expect(decision.riskFlags).toContain("mixed_cre_broker_domain")
    expect(decision.rescueFlags).toContain("direct_to_matt")
  })

  it("allows exact active safe skip only when no rescue flags are present", () => {
    const decision = evaluateEmailAcquisition(
      message({
        subject: "Weekly promo",
        toRecipients: [],
        bodyPreview: undefined,
        internetMessageHeaders: [],
      }),
      context({
        normalizedSender: {
          address: "blast@example.com",
          displayName: "Blast",
          isInternal: false,
          normalizationFailed: false,
        },
        hints: {
          senderInContacts: false,
          mattRepliedBefore: false,
          threadSize: 0,
          domainIsLargeCreBroker: false,
        },
      }),
      { ...noiseClassification, source: "layer-b-sender-drop" },
      {
        runMode: "active",
        rules: [
          {
            ...activeRule(),
            ruleId: "layer-b-sender-drop",
            source: "layer-b-sender-drop",
          },
        ],
      }
    )
    expect(decision.bodyDecision).toBe("safe_body_skip")
  })

  it("body fetch failure fails closed to quarantine", () => {
    const decision = evaluateEmailAcquisition(
      message(),
      context(),
      noiseClassification
    )
    const failed = evaluateBodyFetchFailure(decision, "500")
    expect(failed.bodyDecision).toBe("metadata_only_quarantine")
    expect(failed.disposition).toBe("body_fetch_failed")
  })

  it("collects explicit risk and rescue flags", () => {
    expect(collectEmailRiskFlags(message(), context())).toEqual(
      expect.arrayContaining(["list_unsubscribe", "mixed_cre_broker_domain"])
    )
    expect(collectEmailRescueFlags(message(), context())).toEqual(
      expect.arrayContaining([
        "large_cre_broker",
        "direct_to_matt",
        "deal_or_document_terms",
      ])
    )
  })

  it("enforces numeric stop gates", () => {
    expect(
      evaluateStopGates({
        criticalFalseNegativeCount: 1,
        bodyFetchAttempted: 100,
        bodyFetchFailed: 3,
        graph429Count: 4,
        graph5xxCount: 2,
        messagesSeen: 100,
        missingIdentityCount: 1,
        redactionFailureCount: 1,
        unsafeMixedCreSafeSkips: 1,
        unsafeListUnsubscribeSafeSkips: 1,
        unpinnedActiveRuleCount: 1,
        cursorWouldAdvanceBeforeAudit: true,
        rawBodyWithoutPolicyCount: 1,
      })
    ).toEqual(
      expect.arrayContaining([
        "critical_false_negative",
        "body_fetch_failure_rate",
        "graph_error_rate",
        "missing_identity_rate",
        "redaction_failure_rate",
        "mixed_cre_safe_skip",
        "list_unsubscribe_safe_skip",
        "unpinned_active_rule",
        "cursor_before_audit",
        "raw_body_without_policy",
      ])
    )
  })
})
