import type { EmailFilterRuleDefinition } from "./email-filter-rules"
import type {
  ClassificationResult,
  EmailAcquisitionDecision,
  EmailFilterRunMode,
  EmailRescueFlag,
  EmailRiskFlag,
  FilterContext,
  GraphEmailMessage,
} from "./email-types"

import {
  hasAutomatedLocalPart,
  hasUnsubscribeHeader,
  isJunkOrDeletedFolder,
  isNoiseDomain,
  isNoiseSenderAddress,
} from "./email-filter"
import {
  SEEDED_EMAIL_FILTER_RULES,
  findSeededEmailFilterRule,
  isPromotionMode,
} from "./email-filter-rules"

const PLATFORM_LEAD_SUBJECT =
  /(loopnet lead|favorited|new leads? found|requesting information|new lead has been added|deal stage updated|critical date|documents viewed|ca executed)/i
const DEAL_OR_DOCUMENT_TERMS =
  /(referral|broker|buyer|tenant|landlord|listing|loi|lease|purchase agreement|contract|under contract|closing|commission|voucher|invoice|docusign|dotloop|buildout|tour|sourcing|transacting|critical date)/i

export interface EvaluateEmailAcquisitionOptions {
  runMode?: EmailFilterRunMode
  rules?: readonly EmailFilterRuleDefinition[]
  killSwitch?: boolean
}

function unique<T extends string>(items: T[]): T[] {
  return [...new Set(items)]
}

function directToTarget(
  message: GraphEmailMessage,
  targetUpn: string
): boolean {
  const target = targetUpn.toLowerCase()
  return (message.toRecipients ?? []).some(
    (recipient) => recipient.emailAddress.address?.toLowerCase() === target
  )
}

export function collectEmailRescueFlags(
  message: GraphEmailMessage,
  context: FilterContext
): EmailRescueFlag[] {
  const subject = message.subject ?? ""
  const recipientCount =
    (message.toRecipients?.length ?? 0) + (message.ccRecipients?.length ?? 0)
  const flags: EmailRescueFlag[] = []
  if (context.hints.senderInContacts) flags.push("known_contact")
  if (context.hints.mattRepliedBefore) flags.push("matt_replied_before")
  if (context.hints.threadSize > 1) flags.push("existing_thread")
  if (context.hints.domainIsLargeCreBroker) flags.push("large_cre_broker")
  if (message.hasAttachments) flags.push("has_attachments")
  if (context.normalizedSender.isInternal) flags.push("nai_internal")
  if (directToTarget(message, context.targetUpn)) flags.push("direct_to_matt")
  if (recipientCount > 0 && recipientCount <= 10)
    flags.push("small_recipient_list")
  if (PLATFORM_LEAD_SUBJECT.test(subject)) flags.push("platform_lead_subject")
  if (DEAL_OR_DOCUMENT_TERMS.test(`${subject} ${message.bodyPreview ?? ""}`)) {
    flags.push("deal_or_document_terms")
  }
  return unique(flags)
}

export function collectEmailRiskFlags(
  message: GraphEmailMessage,
  context: FilterContext
): EmailRiskFlag[] {
  const sender = context.normalizedSender.address
  const domain = sender.includes("@") ? sender.split("@")[1] : undefined
  const flags: EmailRiskFlag[] = []
  if (isJunkOrDeletedFolder(message.parentFolderId))
    flags.push("junk_or_deleted")
  if (hasUnsubscribeHeader(message.internetMessageHeaders))
    flags.push("list_unsubscribe")
  if (context.hints.domainIsLargeCreBroker)
    flags.push("mixed_cre_broker_domain")
  if (isNoiseDomain(domain)) flags.push("noise_domain")
  if (isNoiseSenderAddress(sender)) flags.push("noise_sender")
  if (hasAutomatedLocalPart(sender)) flags.push("automated_local_part")
  if (!message.id || !sender) flags.push("missing_identity")
  if (message.bodyPreview) flags.push("body_preview_present")
  return unique(flags)
}

function riskyContextForSafeSkip(
  riskFlags: readonly EmailRiskFlag[],
  rescueFlags: readonly EmailRescueFlag[]
): boolean {
  if (rescueFlags.length > 0) return true
  if (riskFlags.includes("mixed_cre_broker_domain")) return true
  // List-Unsubscribe is never proof by itself; exact active rules must be used.
  return false
}

export function evaluateEmailAcquisition(
  message: GraphEmailMessage,
  context: FilterContext,
  classification: ClassificationResult,
  options: EvaluateEmailAcquisitionOptions = {}
): EmailAcquisitionDecision {
  const runMode = options.runMode ?? "observe"
  const rules = options.rules ?? SEEDED_EMAIL_FILTER_RULES
  const ruleId = classification.ruleId ?? classification.source
  const rule = findSeededEmailFilterRule(ruleId, rules)
  const rescueFlags = collectEmailRescueFlags(message, context)
  const riskFlags = collectEmailRiskFlags(message, context)
  const safeSkipAllowed =
    !options.killSwitch &&
    isPromotionMode(runMode) &&
    rule.enabled &&
    rule.safeSkipCapable &&
    (rule.mode === "active" || rule.mode === "promoted_exact") &&
    rule.rolloutPercent > 0 &&
    classification.classification === "noise" &&
    !riskyContextForSafeSkip(riskFlags, rescueFlags)

  if (safeSkipAllowed) {
    return {
      classification: classification.classification,
      source: classification.source,
      tier1Rule: classification.tier1Rule,
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      runMode,
      bodyDecision: "safe_body_skip",
      disposition: "safe_skip_applied",
      riskFlags,
      rescueFlags,
      evidenceSnapshot: buildEvidenceSnapshot(message, context),
      rationale: "active exact registry rule passed with no rescue flags",
    }
  }

  if (
    classification.classification === "noise" &&
    runMode === "quarantine_only"
  ) {
    return {
      classification: classification.classification,
      source: classification.source,
      tier1Rule: classification.tier1Rule,
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      runMode,
      bodyDecision: "metadata_only_quarantine",
      disposition: "quarantined",
      riskFlags,
      rescueFlags,
      evidenceSnapshot: buildEvidenceSnapshot(message, context),
      rationale: "noise-classified message quarantined; not safe-skipped",
    }
  }

  return {
    classification: classification.classification,
    source: classification.source,
    tier1Rule: classification.tier1Rule,
    ruleId: rule.ruleId,
    ruleVersion: rule.version,
    runMode,
    bodyDecision: "fetch_body",
    disposition:
      classification.classification === "noise" ? "observed" : "fetched_body",
    riskFlags,
    rescueFlags,
    evidenceSnapshot: buildEvidenceSnapshot(message, context),
    rationale:
      classification.classification === "noise"
        ? "Phase 1 observes noise classification but still avoids safe body skip"
        : "signal/uncertain messages require body acquisition",
  }
}

export function evaluateBodyFetchFailure(
  decision: EmailAcquisitionDecision,
  errorCode?: string
): EmailAcquisitionDecision {
  return {
    ...decision,
    bodyDecision: "metadata_only_quarantine",
    disposition: "body_fetch_failed",
    evidenceSnapshot: {
      ...decision.evidenceSnapshot,
      graphErrorCode: errorCode ?? "unknown",
    },
    rationale:
      "body fetch failed; message quarantined/observed and never skipped",
  }
}

function buildEvidenceSnapshot(
  message: GraphEmailMessage,
  context: FilterContext
): Record<string, unknown> {
  const sender = context.normalizedSender.address
  return {
    messageId: message.id,
    internetMessageId: message.internetMessageId,
    conversationId: message.conversationId,
    subject: message.subject ?? null,
    sender,
    senderDomain: sender.includes("@") ? sender.split("@")[1] : null,
    parentFolderId: message.parentFolderId ?? null,
    receivedDateTime: message.receivedDateTime ?? null,
    sentDateTime: message.sentDateTime ?? null,
    toRecipientCount: message.toRecipients?.length ?? 0,
    ccRecipientCount: message.ccRecipients?.length ?? 0,
    hasAttachments: !!message.hasAttachments,
    hasListUnsubscribe: hasUnsubscribeHeader(message.internetMessageHeaders),
    hints: context.hints,
  }
}

export interface StopGateInput {
  criticalFalseNegativeCount: number
  bodyFetchAttempted: number
  bodyFetchFailed: number
  graph429Count: number
  graph5xxCount: number
  messagesSeen: number
  missingIdentityCount: number
  redactionFailureCount: number
  unsafeMixedCreSafeSkips: number
  unsafeListUnsubscribeSafeSkips: number
  unpinnedActiveRuleCount: number
  cursorWouldAdvanceBeforeAudit: boolean
  rawBodyWithoutPolicyCount: number
}

export function evaluateStopGates(input: StopGateInput): string[] {
  const reasons: string[] = []
  const bodyFetchFailureRate = input.bodyFetchAttempted
    ? input.bodyFetchFailed / input.bodyFetchAttempted
    : 0
  const graphErrorRate = input.messagesSeen
    ? (input.graph429Count + input.graph5xxCount) / input.messagesSeen
    : 0
  const missingIdentityRate = input.messagesSeen
    ? input.missingIdentityCount / input.messagesSeen
    : 0
  const redactionFailureRate = input.messagesSeen
    ? input.redactionFailureCount / input.messagesSeen
    : 0
  if (input.criticalFalseNegativeCount > 0)
    reasons.push("critical_false_negative")
  if (bodyFetchFailureRate > 0.02) reasons.push("body_fetch_failure_rate")
  if (graphErrorRate > 0.05) reasons.push("graph_error_rate")
  if (missingIdentityRate > 0.005) reasons.push("missing_identity_rate")
  if (input.unsafeMixedCreSafeSkips > 0) reasons.push("mixed_cre_safe_skip")
  if (input.unsafeListUnsubscribeSafeSkips > 0)
    reasons.push("list_unsubscribe_safe_skip")
  if (input.unpinnedActiveRuleCount > 0) reasons.push("unpinned_active_rule")
  if (input.cursorWouldAdvanceBeforeAudit) reasons.push("cursor_before_audit")
  if (redactionFailureRate > 0.005) reasons.push("redaction_failure_rate")
  if (input.rawBodyWithoutPolicyCount > 0)
    reasons.push("raw_body_without_policy")
  return reasons
}
