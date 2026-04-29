import type { NormalizedSender } from "./sender-normalize"

export type EmailFolder = "inbox" | "sentitems"

export type EmailClassification = "signal" | "noise" | "uncertain"

export type EmailBodyDecision =
  | "fetch_body"
  | "metadata_only_quarantine"
  | "safe_body_skip"

export type EmailFilterRuleMode =
  | "draft"
  | "classification_only"
  | "observe_only"
  | "quarantine_candidate"
  | "promoted_exact"
  | "limited_rollout"
  | "active"
  | "disabled"
  | "retired"

export type EmailFilterRunMode =
  | "dry_run"
  | "observe"
  | "quarantine_only"
  | "promoted_rules_limited"
  | "active"

export type EmailFilterAuditDisposition =
  | "observed"
  | "quarantined"
  | "fetched_body"
  | "body_fetch_failed"
  | "safe_skip_proposed"
  | "safe_skip_applied"
  | "restored"
  | "false_negative"
  | "true_noise"
  | "uncertain"

export type EmailRescueFlag =
  | "known_contact"
  | "matt_replied_before"
  | "existing_thread"
  | "large_cre_broker"
  | "has_attachments"
  | "nai_internal"
  | "direct_to_matt"
  | "small_recipient_list"
  | "platform_lead_subject"
  | "deal_or_document_terms"

export type EmailRiskFlag =
  | "junk_or_deleted"
  | "list_unsubscribe"
  | "mixed_cre_broker_domain"
  | "noise_domain"
  | "noise_sender"
  | "automated_local_part"
  | "missing_identity"
  | "body_preview_present"

export interface EmailAcquisitionDecision {
  classification: EmailClassification
  source: EmailSource
  tier1Rule: string
  ruleId: string
  ruleVersion: number
  runMode: EmailFilterRunMode
  bodyDecision: EmailBodyDecision
  disposition: EmailFilterAuditDisposition
  riskFlags: EmailRiskFlag[]
  rescueFlags: EmailRescueFlag[]
  evidenceSnapshot: Record<string, unknown>
  rationale: string
}

export type EmailSource =
  | "matt-outbound"
  | "nai-internal"
  | "docusign-transactional"
  | "dotloop-transactional"
  | "buildout-event"
  | "loopnet-lead"
  | "crexi-lead"
  | "known-counterparty"
  | "layer-b-domain-drop"
  | "layer-b-sender-drop"
  | "layer-b-local-part-drop"
  | "layer-b-folder-drop"
  | "layer-b-unsubscribe-header"
  | "layer-c"

export interface GraphEmailRecipient {
  emailAddress: { address: string; name?: string }
}

export interface GraphEmailBody {
  contentType: "text" | "html"
  content: string
}

export interface GraphEmailHeader {
  name: string
  value: string
}

export interface GraphEmailMessage {
  id: string
  internetMessageId?: string
  conversationId?: string
  parentFolderId?: string
  subject?: string | null
  from?: { emailAddress: { address: string; name?: string } } | null
  sender?: { emailAddress: { address: string; name?: string } } | null
  toRecipients?: GraphEmailRecipient[]
  ccRecipients?: GraphEmailRecipient[]
  bccRecipients?: GraphEmailRecipient[]
  receivedDateTime?: string
  sentDateTime?: string
  hasAttachments?: boolean
  isRead?: boolean
  importance?: "low" | "normal" | "high"
  body?: GraphEmailBody
  bodyPreview?: string
  internetMessageHeaders?: GraphEmailHeader[]
}

export interface BehavioralHints {
  senderInContacts: boolean
  mattRepliedBefore: boolean
  directOutboundCount?: number
  threadOutboundCount?: number
  threadSize: number
  domainIsLargeCreBroker: boolean
}

export interface FilterContext {
  folder: EmailFolder
  normalizedSender: NormalizedSender
  targetUpn: string
  hints: BehavioralHints
}

export interface ClassificationResult {
  classification: EmailClassification
  source: EmailSource
  tier1Rule: string
  /** Stable rule identifier used by the acquisition/audit layer. */
  ruleId?: string
  /** Version of the classifier/rule that produced this classification. */
  ruleVersion?: number
}

/** Large CRE broker firms whose domains carry a mix of signal + blasts.
 *  Used as a behavioral hint only; does NOT cause drops. */
export const LARGE_CRE_BROKER_DOMAINS = [
  "cbre.com",
  "cushwake.com",
  "cushmanwakefield.com",
  "jll.com",
  "colliers.com",
  "marcusmillichap.com",
  "naiglobal.com",
  "berkshirehathaway.com",
  "bhhs.com",
  "nmrk.com",
  "svn.com",
  "sandsig.com",
  "mwcre.com",
  "newmarkmw.com",
  "eralandmark.com",
  "evrealestate.com",
] as const
