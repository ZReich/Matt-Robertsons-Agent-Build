import type {
  EmailFilterRuleMode,
  EmailFilterRunMode,
  EmailSource,
} from "./email-types"

export const EMAIL_FILTER_RULE_SET_VERSION = "2026-04-26.2"

export interface EmailFilterRuleDefinition {
  ruleId: string
  version: number
  name: string
  source: EmailSource | "acquisition-safety"
  mode: EmailFilterRuleMode
  enabled: boolean
  rolloutPercent: number
  owner: string
  rationale: string
  matchDefinition: Record<string, unknown>
  evidenceRequired: Record<string, unknown>
  rescueConditions: string[]
  samplePolicy: {
    minReviewed: number
    percentIfFewerThan1000: number
    criticalFalseNegativesAllowed: 0
  }
  promotionCriteria: {
    minMessagesOrDays: { messages: number; days: number }
    maxNonCriticalUncertainRate: number
    maxBodyFetchFailureRate: number
    requiresProductOwnerApproval: boolean
    requiresReleaseLeadApproval: boolean
    requiresPrivacySecurityApproval: boolean
  }
  demotionPolicy: {
    demoteOnCriticalFalseNegative: boolean
    demoteOnUnreviewedRuleChange: boolean
  }
  safeSkipCapable: boolean
}

const STANDARD_SAMPLE = {
  minReviewed: 100,
  percentIfFewerThan1000: 10,
  criticalFalseNegativesAllowed: 0 as const,
}

const MIXED_CRE_SAMPLE = {
  minReviewed: 200,
  percentIfFewerThan1000: 10,
  criticalFalseNegativesAllowed: 0 as const,
}

const BASE_PROMOTION = {
  minMessagesOrDays: { messages: 2000, days: 14 },
  maxNonCriticalUncertainRate: 0.005,
  maxBodyFetchFailureRate: 0.02,
  requiresProductOwnerApproval: true,
  requiresReleaseLeadApproval: true,
  requiresPrivacySecurityApproval: true,
}

const BASE_DEMOTION = {
  demoteOnCriticalFalseNegative: true,
  demoteOnUnreviewedRuleChange: true,
}

export const SEEDED_EMAIL_FILTER_RULES: readonly EmailFilterRuleDefinition[] = [
  {
    ruleId: "layer-b-folder-drop",
    version: 1,
    name: "Junk/deleted folder candidate",
    source: "layer-b-folder-drop",
    mode: "observe_only",
    enabled: true,
    rolloutPercent: 0,
    owner: "release-lead",
    rationale:
      "Junk/deleted mail can become a future metadata-only skip only after explicit owner confirmation and sample review.",
    matchDefinition: { parentFolderId: ["junk", "junkemail", "deleteditems"] },
    evidenceRequired: { ownerConfirmation: true, sampleReview: true },
    rescueConditions: [
      "known_contact",
      "matt_replied_before",
      "existing_thread",
      "platform_lead_subject",
    ],
    samplePolicy: {
      minReviewed: 50,
      percentIfFewerThan1000: 5,
      criticalFalseNegativesAllowed: 0,
    },
    promotionCriteria: BASE_PROMOTION,
    demotionPolicy: BASE_DEMOTION,
    safeSkipCapable: true,
  },
  {
    ruleId: "layer-b-domain-drop",
    version: 1,
    name: "Known marketing/listing domains",
    source: "layer-b-domain-drop",
    mode: "observe_only",
    enabled: true,
    rolloutPercent: 0,
    owner: "release-lead",
    rationale:
      "Existing domain-noise classifications remain classification-only until exact sender/pattern samples prove they are safe.",
    matchDefinition: { requiresExactDomainOrSubdomain: true },
    evidenceRequired: { exactSenderOrPattern: true, sampleReview: true },
    rescueConditions: [
      "large_cre_broker",
      "known_contact",
      "matt_replied_before",
      "existing_thread",
      "direct_to_matt",
      "has_attachments",
    ],
    samplePolicy: STANDARD_SAMPLE,
    promotionCriteria: BASE_PROMOTION,
    demotionPolicy: BASE_DEMOTION,
    safeSkipCapable: true,
  },
  {
    ruleId: "layer-b-sender-drop",
    version: 1,
    name: "Exact sender noise candidates",
    source: "layer-b-sender-drop",
    mode: "observe_only",
    enabled: true,
    rolloutPercent: 0,
    owner: "release-lead",
    rationale:
      "Exact senders are safer than broad domains but still require sample proof before body skip.",
    matchDefinition: { exactSender: true },
    evidenceRequired: { sampleReview: true, noRescueFlags: true },
    rescueConditions: [
      "platform_lead_subject",
      "deal_or_document_terms",
      "known_contact",
      "matt_replied_before",
      "existing_thread",
    ],
    samplePolicy: STANDARD_SAMPLE,
    promotionCriteria: BASE_PROMOTION,
    demotionPolicy: BASE_DEMOTION,
    safeSkipCapable: true,
  },
  {
    ruleId: "layer-b-local-part-drop",
    version: 1,
    name: "Automated local-part candidates",
    source: "layer-b-local-part-drop",
    mode: "observe_only",
    enabled: true,
    rolloutPercent: 0,
    owner: "release-lead",
    rationale:
      "No-reply/newsletter-style local parts are weak noise signals and cannot override rescue flags.",
    matchDefinition: { automatedLocalPart: true },
    evidenceRequired: { sampleReview: true, noRescueFlags: true },
    rescueConditions: [
      "large_cre_broker",
      "known_contact",
      "matt_replied_before",
      "existing_thread",
      "platform_lead_subject",
    ],
    samplePolicy: STANDARD_SAMPLE,
    promotionCriteria: BASE_PROMOTION,
    demotionPolicy: BASE_DEMOTION,
    safeSkipCapable: true,
  },
  {
    ruleId: "layer-b-unsubscribe-header",
    version: 1,
    name: "List-Unsubscribe candidate",
    source: "layer-b-unsubscribe-header",
    mode: "quarantine_candidate",
    enabled: true,
    rolloutPercent: 0,
    owner: "product-owner",
    rationale:
      "List-Unsubscribe is common in true noise and in valuable CRE blasts/referrals, so it starts quarantined and never acts alone in risky contexts.",
    matchDefinition: { header: "List-Unsubscribe" },
    evidenceRequired: { mixedCreSampleReview: true, noRiskyContext: true },
    rescueConditions: [
      "large_cre_broker",
      "known_contact",
      "matt_replied_before",
      "existing_thread",
      "direct_to_matt",
      "has_attachments",
      "platform_lead_subject",
      "deal_or_document_terms",
    ],
    samplePolicy: MIXED_CRE_SAMPLE,
    promotionCriteria: BASE_PROMOTION,
    demotionPolicy: BASE_DEMOTION,
    safeSkipCapable: true,
  },
  {
    ruleId: "classification-safety-default",
    version: 1,
    name: "Classification/body acquisition separation",
    source: "acquisition-safety",
    mode: "active",
    enabled: true,
    rolloutPercent: 100,
    owner: "release-lead",
    rationale:
      "Noise classification is never sufficient by itself to skip body acquisition or audit persistence.",
    matchDefinition: { allMessages: true },
    evidenceRequired: { registryDecision: true },
    rescueConditions: ["any"],
    samplePolicy: STANDARD_SAMPLE,
    promotionCriteria: BASE_PROMOTION,
    demotionPolicy: BASE_DEMOTION,
    safeSkipCapable: false,
  },
]

export function assertUniqueEmailFilterRules(
  rules: readonly EmailFilterRuleDefinition[] = SEEDED_EMAIL_FILTER_RULES
): void {
  const seen = new Set<string>()
  for (const rule of rules) {
    const key = `${rule.ruleId}:${rule.version}`
    if (seen.has(key)) throw new Error(`duplicate email filter rule ${key}`)
    seen.add(key)
  }
}

export function findSeededEmailFilterRule(
  ruleId: string | undefined,
  rules: readonly EmailFilterRuleDefinition[] = SEEDED_EMAIL_FILTER_RULES
): EmailFilterRuleDefinition {
  return (
    rules.find((rule) => rule.ruleId === ruleId) ??
    rules.find((rule) => rule.ruleId === "classification-safety-default") ??
    rules[0]
  )
}

export function createRuleVersionSnapshot(
  rules: readonly EmailFilterRuleDefinition[] = SEEDED_EMAIL_FILTER_RULES
): Record<
  string,
  { version: number; mode: EmailFilterRuleMode; enabled: boolean }
> {
  assertUniqueEmailFilterRules(rules)
  return Object.fromEntries(
    rules.map((rule) => [
      rule.ruleId,
      { version: rule.version, mode: rule.mode, enabled: rule.enabled },
    ])
  )
}

export function isPromotionMode(mode: EmailFilterRunMode): boolean {
  return mode === "active" || mode === "promoted_rules_limited"
}
