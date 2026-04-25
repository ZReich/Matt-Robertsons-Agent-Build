import type { NormalizedSender } from "./sender-normalize"

export type EmailFolder = "inbox" | "sentitems"

export type EmailClassification = "signal" | "noise" | "uncertain"

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
