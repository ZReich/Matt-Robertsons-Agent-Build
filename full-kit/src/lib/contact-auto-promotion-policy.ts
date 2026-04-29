export const CONTACT_AUTO_PROMOTION_POLICY_VERSION = "v1"

const AUTO_CREATE_THRESHOLD = 80

export type AutoPromotionDecision =
  | "auto_link_existing"
  | "auto_create_contact"
  | "review_required"
  | "blocked"

export type ContactAutoPromotionMode = "off" | "dry_run" | "write"

export function readContactAutoPromotionMode(
  value = process.env.CONTACT_AUTO_PROMOTION_MODE
): ContactAutoPromotionMode {
  return value === "off" || value === "dry_run" || value === "write"
    ? value
    : "write"
}

export type ContactAutoPromotionInput = {
  classification: string | null
  source: string | null
  direction: "inbound" | "outbound" | null
  normalizedEmail: string
  displayName?: string | null
  isInternal?: boolean
  normalizationFailed?: boolean
  existingContactId?: string | null
  existingLeadContactId?: string | null
  contactMatches: Array<{ id: string; archivedAt?: Date | string | null }>
  currentCommunicationId?: string | null
  currentHasRealAttachment?: boolean
  mattRepliedBefore?: boolean
  materialCommunicationCount?: number
  outboundAttachmentEvidenceIds?: string[]
}

export type ContactAutoPromotionResult = {
  decision: AutoPromotionDecision
  policyVersion: typeof CONTACT_AUTO_PROMOTION_POLICY_VERSION
  score: number
  reasonCodes: string[]
  blockedReasons: string[]
  evidenceCommunicationIds: string[]
  matchedContactId: string | null
}

export type AttachmentLike = {
  name?: unknown
  isInline?: unknown
}

export type AttachmentFetchLike = {
  status?: unknown
  nonInlineCount?: unknown
}

export function hasRealAttachmentEvidence({
  attachments,
  attachmentFetch,
}: {
  attachments?: AttachmentLike[] | null
  attachmentFetch?: AttachmentFetchLike | null
}): boolean {
  if (
    attachmentFetch?.status === "success" &&
    typeof attachmentFetch.nonInlineCount === "number"
  ) {
    return attachmentFetch.nonInlineCount > 0
  }
  if (!Array.isArray(attachments)) return false
  return attachments.some((attachment) => {
    if (!attachment || attachment.isInline === true) return false
    return attachment.name === undefined || typeof attachment.name === "string"
  })
}

export function hasRealAttachmentEvidenceFromMetadata(
  metadata: unknown
): boolean {
  const record = asRecord(metadata)
  return hasRealAttachmentEvidence({
    attachments: Array.isArray(record.attachments)
      ? (record.attachments as AttachmentLike[])
      : null,
    attachmentFetch: asRecord(record.attachmentFetch) as AttachmentFetchLike,
  })
}

export function evaluateContactAutoPromotion(
  input: ContactAutoPromotionInput
): ContactAutoPromotionResult {
  const reasonCodes: string[] = []
  const blockedReasons: string[] = []
  const evidenceCommunicationIds = new Set<string>()
  if (input.currentCommunicationId) {
    evidenceCommunicationIds.add(input.currentCommunicationId)
  }
  for (const id of input.outboundAttachmentEvidenceIds ?? []) {
    evidenceCommunicationIds.add(id)
  }

  const email = input.normalizedEmail.trim().toLowerCase()
  const activeMatches = input.contactMatches.filter(
    (match) => !match.archivedAt
  )

  if (!email.includes("@")) blockedReasons.push("invalid_email")
  if (input.normalizationFailed) blockedReasons.push("normalization_failed")
  if (input.isInternal) blockedReasons.push("internal_sender")
  if (input.classification !== "signal") {
    blockedReasons.push(`non_signal:${input.classification ?? "unknown"}`)
  }
  if (isPlatformLeadSource(input.source)) {
    blockedReasons.push(`platform_source:${input.source}`)
  }
  if (isBlockedAutomationAddress(email)) {
    blockedReasons.push("automation_or_platform_address")
  }
  if (input.existingContactId || input.existingLeadContactId) {
    blockedReasons.push("communication_already_resolved")
  }

  if (blockedReasons.length > 0) {
    return result("blocked", 0, reasonCodes, blockedReasons, [
      ...evidenceCommunicationIds,
    ])
  }

  if (activeMatches.length > 1) {
    return result(
      "review_required",
      0,
      ["duplicate_contact_email"],
      [],
      [...evidenceCommunicationIds],
      null
    )
  }

  const matchedContactId = activeMatches[0]?.id ?? null
  if (matchedContactId) {
    return result(
      "auto_link_existing",
      100,
      ["single_existing_contact_email_match"],
      [],
      [...evidenceCommunicationIds],
      matchedContactId
    )
  }

  if (input.direction !== "inbound" && input.direction !== "outbound") {
    return result(
      "review_required",
      0,
      ["not_inbound_unknown_sender"],
      [],
      [...evidenceCommunicationIds]
    )
  }

  let score = 0
  const hasOutboundAttachment = (input.outboundAttachmentEvidenceIds ?? [])
    .length
  if (hasOutboundAttachment || input.direction === "outbound") {
    score += 50
    reasonCodes.push("matt_sent_non_inline_attachment")
  }
  if (input.currentHasRealAttachment && input.mattRepliedBefore) {
    score += 50
    reasonCodes.push("inbound_non_inline_attachment_plus_matt_reply")
  } else if (input.currentHasRealAttachment) {
    score += 25
    reasonCodes.push("inbound_non_inline_attachment")
  }
  if (input.mattRepliedBefore) {
    score += 35
    reasonCodes.push("matt_replied_or_direct_outbound")
  }
  if ((input.materialCommunicationCount ?? 0) >= 3) {
    score += 35
    reasonCodes.push("recurring_material_thread")
  }
  if (hasUsefulDisplayName(input.displayName, email)) {
    score += 10
    reasonCodes.push("sender_display_name")
  }
  if (isFreeMailAddress(email)) {
    score -= 10
    reasonCodes.push("free_mail_penalty")
  }
  if (isRoleAccount(email)) {
    score -= 25
    reasonCodes.push("role_account_penalty")
  }

  if (score >= AUTO_CREATE_THRESHOLD) {
    return result(
      "auto_create_contact",
      score,
      reasonCodes,
      [],
      [...evidenceCommunicationIds]
    )
  }

  return result(
    "review_required",
    score,
    reasonCodes.length > 0 ? reasonCodes : ["weak_unknown_sender_evidence"],
    [],
    [...evidenceCommunicationIds]
  )
}

function result(
  decision: AutoPromotionDecision,
  score: number,
  reasonCodes: string[],
  blockedReasons: string[],
  evidenceCommunicationIds: string[],
  matchedContactId: string | null = null
): ContactAutoPromotionResult {
  return {
    decision,
    policyVersion: CONTACT_AUTO_PROMOTION_POLICY_VERSION,
    score,
    reasonCodes,
    blockedReasons,
    evidenceCommunicationIds,
    matchedContactId,
  }
}

function isPlatformLeadSource(source: string | null): boolean {
  return (
    source === "crexi-lead" ||
    source === "loopnet-lead" ||
    source === "buildout-event"
  )
}

function isBlockedAutomationAddress(email: string): boolean {
  const [local = "", domain = ""] = email.split("@")
  if (
    /^(no-?reply|do-?not-?reply|notification|notifications|mailer|postmaster)$/i.test(
      local
    )
  ) {
    return true
  }
  return [
    "buildout.com",
    "crexi.com",
    "loopnet.com",
    "costar.com",
    "docusign.net",
    "dotloop.com",
  ].some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))
}

function isRoleAccount(email: string): boolean {
  const local = email.split("@")[0] ?? ""
  return /^(info|admin|office|leasing|sales|support|hello|contact|team)$/i.test(
    local
  )
}

function isFreeMailAddress(email: string): boolean {
  const domain = email.split("@")[1] ?? ""
  return [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
  ].includes(domain)
}

function hasUsefulDisplayName(
  displayName: string | null | undefined,
  email: string
): boolean {
  const value = displayName?.trim()
  if (!value) return false
  if (value.toLowerCase() === email) return false
  return !value.includes("@")
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
