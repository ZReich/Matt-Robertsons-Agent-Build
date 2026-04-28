export const PROMPT_VERSION = "v2"
export const PROMPT_RELEASED_AT = "2026-04-28T00:00:00.000Z"

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

export type SuggestedAction = {
  actionType:
    | "create-todo"
    | "move-deal-stage"
    | "update-deal"
    | "create-meeting"
    | "update-meeting"
    | "create-agent-memory"
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
  modelUsed: string
  promptVersion: string
  scrubbedAt: string
  tokensIn: number
  tokensOut: number
  cacheHitTokens: number
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
