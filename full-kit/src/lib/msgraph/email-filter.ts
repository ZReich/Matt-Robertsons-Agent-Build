import type {
  ClassificationResult,
  FilterContext,
  GraphEmailHeader,
  GraphEmailMessage,
} from "./email-types"

import { LARGE_CRE_BROKER_DOMAINS } from "./email-types"

// =============================================================================
// NOISE CONSTANTS
// =============================================================================

/** Domains whose mail is blanket-dropped as noise. Subdomains also match. */
export const NOISE_DOMAINS: ReadonlySet<string> = new Set([
  "flexmail.flexmls.com",
  "e.mail.realtor.com",
  "notifications.realtor.com",
  "shared1.ccsend.com",
  "bhhs-ecards.com",
  "email-whitepages.com",
  "propertyblast.com",
  "encorereis.com",
  "atlanticretail.reverecre.com",
  "mail.beehiiv.com",
  "publications.bisnow.com",
  "news.bdcnetwork.com",
  "daily.therundown.ai",
  "wrenews.com",
  "retechnology.com",
  "trepp.com",
  "alm.com",
  "infabode.com",
  "rentalbeast.com",
  "mail1.nnn.market",
  "toasttab.com",
  "e.allegiant.com",
  "h5.hilton.com",
  "notification.intuit.com",
  "gohighlevel.com",
  "80eighty.com",
  "oofos.com",
  "lumecube.com",
  "theceshop.com",
  "marketing.ecommission.com",
  "fayranches.com",
])

/** Specific sender addresses that are always noise regardless of domain policy. */
export const NOISE_SENDER_ADDRESSES: ReadonlySet<string> = new Set([
  "emails@pro.crexi.com",
  "emails@search.crexi.com",
  "emails@campaigns.crexi.com",
  "notifications@pro.crexi.com",
  "auctions@notifications.crexi.com",
  "nlpg@cbre.com",
  "yafcteam@comms.cushwakedigital.com",
  "loopnet@email.loopnet.com",
  "noreply@loopnet.com",
  "sales@loopnet.com",
])

/** Senders whose domains are allowlisted in Layer A and therefore should bypass
 *  the generic "no-reply local part" drop rule. */
export const TRANSACTIONAL_ALLOWLIST_DOMAINS: ReadonlySet<string> = new Set([
  "docusign.net",
  "buildout.com",
  "notifications.crexi.com",
  "loopnet.com",
  "dotloop.com",
])

export const AUTOMATED_LOCAL_PART_DROP =
  /^(news|newsletter|digest|updates?|marketing|alerts?|announce|broadcast)[0-9]*(\+.*)?$/i

export const AUTOMATED_NOREPLY_PATTERN =
  /^(no-?reply|donotreply|do-not-reply|mailer|postmaster|bounces?|delivery)(\+.*)?$/i

/** Well-known folder names Graph emits as `parentFolderId` display names, plus
 *  common Well-Known Folder IDs in case Graph returns IDs rather than names. */
export const JUNK_FOLDER_NAMES: readonly string[] = [
  "junkemail",
  "junk email",
  "junk",
  "deleteditems",
  "deleted items",
  "deleted",
]

// =============================================================================
// PREDICATES
// =============================================================================

export function isNoiseDomain(domain: string | undefined): boolean {
  if (!domain) return false
  const d = domain.toLowerCase()
  if (NOISE_DOMAINS.has(d)) return true
  for (const noise of NOISE_DOMAINS) {
    if (d.endsWith(`.${noise}`)) return true
  }
  return false
}

export function isNoiseSenderAddress(address: string | undefined): boolean {
  if (!address) return false
  return NOISE_SENDER_ADDRESSES.has(address.toLowerCase())
}

export function hasAutomatedLocalPart(address: string | undefined): boolean {
  if (!address) return false
  const atIdx = address.indexOf("@")
  if (atIdx <= 0) return false
  const localPart = address.slice(0, atIdx)
  return (
    AUTOMATED_LOCAL_PART_DROP.test(localPart) ||
    AUTOMATED_NOREPLY_PATTERN.test(localPart)
  )
}

export function hasUnsubscribeHeader(
  headers: GraphEmailHeader[] | undefined
): boolean {
  if (!headers) return false
  return headers.some((h) => h.name.toLowerCase() === "list-unsubscribe")
}

export function isJunkOrDeletedFolder(folderHint: string | undefined): boolean {
  if (!folderHint) return false
  return JUNK_FOLDER_NAMES.includes(folderHint.toLowerCase())
}

export function domainIsLargeCreBroker(domain: string | undefined): boolean {
  if (!domain) return false
  return (LARGE_CRE_BROKER_DOMAINS as readonly string[]).includes(
    domain.toLowerCase()
  )
}

// =============================================================================
// SUBJECT-LINE REGEXES (used by classifyEmail)
// =============================================================================

const CREXI_LEAD_SUBJECT =
  /(new leads? found for|requesting information on|new leads to be contacted|entered a note on)/i
const CREXI_NOISE_SUBJECT_ON_NOTIFICATIONS =
  /^(updates have been made to|action required!|\d+ of your properties|.*search ranking)/i
const BUILDOUT_SUPPORT_SIGNAL_SUBJECT =
  /^(a new lead has been added|.*information requested by|deal stage updated on|you've been assigned a task|tasks? (?:were )?assigned to you on|.*critical date|ca executed on|voucher approved|new voucher deposit|new commission payment|buildout:\s*\d+\s+day expiration notice)/i
const BUILDOUT_NOTIFICATION_SIGNAL_SUBJECT =
  /^(documents viewed on|ca executed on)/i
const LOOPNET_LEAD_SUBJECT = /^(loopnet lead for|.* favorited)/i

const MAX_TO_RECIPIENTS_FOR_SIGNAL = 10

// =============================================================================
// COMPOSITE CLASSIFIER
// =============================================================================

/**
 * Classify a Graph email message into signal/noise/uncertain with a typed
 * source tag. Pure function — the orchestrator is responsible for providing
 * the filter context (normalized sender, folder, behavioral hints).
 */
export function classifyEmail(
  message: GraphEmailMessage,
  context: FilterContext
): ClassificationResult {
  const { folder, normalizedSender, targetUpn, hints } = context
  const sender = normalizedSender.address
  const senderDomain = sender.includes("@") ? sender.split("@")[1] : ""
  const subject = message.subject ?? ""
  const headers = message.internetMessageHeaders

  // --- Layer A: auto-signal allowlist ---
  if (folder === "sentitems") {
    return {
      classification: "signal",
      source: "matt-outbound",
      tier1Rule: "sent-items",
    }
  }

  // If Matt has replied to or forwarded within a conversation, keep the whole
  // thread for second-brain context even when individual inbound messages look
  // like list/noise traffic.
  if (hints.mattRepliedBefore) {
    return {
      classification: "signal",
      source: "known-counterparty",
      tier1Rule: "matt-engaged-thread",
    }
  }

  // --- Layer B folder check runs before non-engaged signal checks so
  // Junk/Deleted don't masquerade as signal unless Matt already engaged.
  if (isJunkOrDeletedFolder(message.parentFolderId)) {
    return {
      classification: "noise",
      source: "layer-b-folder-drop",
      tier1Rule: "folder",
    }
  }

  // NAI internal: Matt must be a direct recipient, To list must not look like a blast,
  // and no List-Unsubscribe.
  if (normalizedSender.isInternal) {
    const toList = message.toRecipients ?? []
    const mattInTo = toList.some(
      (r) => r.emailAddress.address?.toLowerCase() === targetUpn.toLowerCase()
    )
    const reasonableToSize = toList.length <= MAX_TO_RECIPIENTS_FOR_SIGNAL
    if (mattInTo && reasonableToSize && !hasUnsubscribeHeader(headers)) {
      return {
        classification: "signal",
        source: "nai-internal",
        tier1Rule: "nai-direct",
      }
    }
  }

  if (
    senderDomain === "docusign.net" ||
    senderDomain.endsWith(".docusign.net")
  ) {
    return {
      classification: "signal",
      source: "docusign-transactional",
      tier1Rule: "docusign",
    }
  }

  if (sender === "hit-reply@dotloop.com") {
    return {
      classification: "signal",
      source: "dotloop-transactional",
      tier1Rule: "dotloop",
    }
  }

  if (
    sender === "support@buildout.com" &&
    BUILDOUT_SUPPORT_SIGNAL_SUBJECT.test(subject)
  ) {
    return {
      classification: "signal",
      source: "buildout-event",
      tier1Rule: "buildout-support",
    }
  }
  if (
    sender === "no-reply-notification@buildout.com" &&
    BUILDOUT_NOTIFICATION_SIGNAL_SUBJECT.test(subject)
  ) {
    return {
      classification: "signal",
      source: "buildout-event",
      tier1Rule: "buildout-notification",
    }
  }

  if (sender === "leads@loopnet.com" && LOOPNET_LEAD_SUBJECT.test(subject)) {
    return {
      classification: "signal",
      source: "loopnet-lead",
      tier1Rule: "loopnet-leads",
    }
  }

  if (
    senderDomain.endsWith("notifications.crexi.com") &&
    CREXI_LEAD_SUBJECT.test(subject)
  ) {
    return {
      classification: "signal",
      source: "crexi-lead",
      tier1Rule: "crexi-notifications",
    }
  }

  // --- Layer B: hard-drop noise ---

  // Crexi notifications carry both signal subjects (above) and noise subjects (below).
  // If it's a notifications.crexi.com sender and the subject is a known noise pattern,
  // explicit sender-level drop.
  if (
    senderDomain.endsWith("notifications.crexi.com") &&
    CREXI_NOISE_SUBJECT_ON_NOTIFICATIONS.test(subject)
  ) {
    return {
      classification: "noise",
      source: "layer-b-sender-drop",
      tier1Rule: "crexi-notification-noise",
    }
  }

  if (isNoiseDomain(senderDomain)) {
    return {
      classification: "noise",
      source: "layer-b-domain-drop",
      tier1Rule: "noise-domain",
    }
  }

  if (isNoiseSenderAddress(sender)) {
    return {
      classification: "noise",
      source: "layer-b-sender-drop",
      tier1Rule: "noise-sender",
    }
  }

  // No-reply / news / marketing etc. unless from an allowlisted transactional domain
  if (
    hasAutomatedLocalPart(sender) &&
    !TRANSACTIONAL_ALLOWLIST_DOMAINS.has(senderDomain)
  ) {
    return {
      classification: "noise",
      source: "layer-b-local-part-drop",
      tier1Rule: "automated-local-part",
    }
  }

  if (hasUnsubscribeHeader(headers)) {
    return {
      classification: "noise",
      source: "layer-b-unsubscribe-header",
      tier1Rule: "list-unsubscribe",
    }
  }

  // --- Layer C: uncertain, store body for later classification ---
  return {
    classification: "uncertain",
    source: "layer-c",
    tier1Rule: "fallthrough",
  }
}
