export const PROMPT_VERSION = "v7"
export const PROMPT_RELEASED_AT = "2026-05-04T00:00:00.000Z"

export const TOPIC_TAGS = [
  "showing-scheduling",
  "loi-or-offer",
  "proforma-request",
  "financing",
  "tour-feedback",
  "contract-signing",
  "closing-logistics",
  "due-diligence",
  "pricing-discussion",
  "new-lead-inquiry",
  "referral",
  "internal-coordination",
  "personal",
  "admin-logistics",
  "other",
] as const

export const URGENCIES = ["urgent", "soon", "normal", "fyi"] as const
export const SENTIMENTS = [
  "positive",
  "neutral",
  "negative",
  "frustrated",
] as const
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const
export const MEMORY_TYPES = [
  "rule",
  "preference",
  "playbook",
  "client_note",
  "style_guide",
] as const
export const DEAL_STAGES = [
  "prospecting",
  "listing",
  "marketing",
  "showings",
  "offer",
  "under_contract",
  "due_diligence",
  "closing",
  "closed",
] as const

/**
 * Profile fact taxonomy.
 *
 * The original RALPLAN Phase 5 set (preference / communication_style /
 * schedule_constraint / deal_interest / objection / important_date) covered
 * transactional + workflow facts only. PROMPT_VERSION v6 (2026-05-04) added
 * the `family / pets / hobbies / vehicles / sports / travel / food /
 * personal_milestone` buckets so Matt's relationship profile surfaces the
 * humanizing context he uses to open conversations — kid's name, dog's
 * breed, recent fishing trip, etc.
 *
 * Personal categories are subject to the same drop-list (medical, legal,
 * financial distress, protected-class) enforced in scrub-applier
 * `FORBIDDEN_AUTO_FACT_PATTERN`. The `caution` wordingClass route remains
 * the safety valve for anything ambiguous.
 *
 * v7 (2026-05-04) keeps the same taxonomy but loosens the extractor
 * prompt so casual / inferred personal signals (subject-line inside
 * jokes, sign-off names, vehicle references) produce low-confidence
 * facts rather than empty arrays. Auto-save threshold (0.85 in
 * scrub-applier) is unchanged, so inferred facts route to review.
 *
 * The DB column `contact_profile_facts.category` is `text`, so adding
 * categories does NOT require a Prisma migration — only the validator,
 * extractor prompt, and rendering layer need updating.
 */
export const PROFILE_FACT_CATEGORIES = [
  "preference",
  "communication_style",
  "schedule_constraint",
  "deal_interest",
  "objection",
  "important_date",
  // Personal / relationship-building categories (added v6).
  "family",
  "pets",
  "hobbies",
  "vehicles",
  "sports",
  "travel",
  "food",
  "personal_milestone",
] as const

export const PROFILE_FACT_WORDING_CLASSES = [
  "operational",
  "relationship_context",
  "business_context",
  "caution",
] as const

export type SuggestedAction = {
  actionType:
    | "create-todo"
    | "move-deal-stage"
    | "update-deal"
    | "create-meeting"
    | "update-meeting"
    | "create-agent-memory"
    | "mark-todo-done"
  summary: string
  payload: Record<string, unknown>
}

export type ScrubOutput = {
  summary: string
  topicTags: Array<(typeof TOPIC_TAGS)[number]>
  urgency: (typeof URGENCIES)[number]
  replyRequired: boolean
  sentiment: (typeof SENTIMENTS)[number] | null
  linkedContactCandidates: Array<{
    contactId: string
    confidence: number
    reason: string
  }>
  linkedDealCandidates: Array<{
    dealId: string
    confidence: number
    reason: string
    matchedVia:
      | "property_address"
      | "property_name"
      | "key_contact"
      | "subject_match"
  }>
  profileFacts: ContactProfileFactSuggestion[]
  modelUsed: string
  promptVersion: string
  scrubbedAt: string
  tokensIn: number
  tokensOut: number
  cacheHitTokens: number
}

export type ContactProfileFactSuggestion = {
  category: (typeof PROFILE_FACT_CATEGORIES)[number]
  fact: string
  normalizedKey: string
  confidence: number
  wordingClass: (typeof PROFILE_FACT_WORDING_CLASSES)[number]
  contactId: string
  sourceCommunicationId: string
  observedAt?: string
  expiresAt?: string
  evidence?: string
}

export type ValidatedScrubResult = {
  scrubOutput: Omit<
    ScrubOutput,
    | "modelUsed"
    | "promptVersion"
    | "scrubbedAt"
    | "tokensIn"
    | "tokensOut"
    | "cacheHitTokens"
  >
  suggestedActions: SuggestedAction[]
  /**
   * In relaxed mode, per-action Zod failures are dropped (not fatal).
   * Count of dropped actions is carried through for digest logging.
   */
  droppedActions: number
}

export type ClaimedScrubQueueRow = {
  id: string
  communicationId: string
  leaseToken: string
}
