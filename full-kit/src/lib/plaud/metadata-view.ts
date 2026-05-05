/**
 * Allow-listed projection of `Communication.metadata` for the
 * Transcripts UI. Used by both the GET /api/transcripts/[id] route AND
 * the server-rendered detail page so they expose the same fields. Hides
 * internal AI error blobs (which `redactSecrets` only best-effort
 * scrubs) from the rendered tree.
 */

export interface SafeTranscriptMetadata {
  source: "plaud"
  plaudId: string | null
  plaudFilename: string | null
  plaudTagIds: string[]
  cleanedTurns: Array<{
    speaker: string
    content: string
    startMs: number
    endMs: number
  }>
  aiSummaryRaw: string | null
  extractedSignals: {
    counterpartyName: string | null
    topic: string | null
    tailSynopsis: string | null
  } | null
  aiSkipReason: "sensitive_keywords" | undefined
  suggestions: Array<{
    contactId: string
    score: number
    source: string
    reason: string
  }>
  dealSuggestions: Array<{
    dealId: string
    contactId: string
    score: number
    source: string
    reason: string
  }>
  attachedAt: string | undefined
  attachedBy: string | undefined
  attachedFromSuggestion:
    | { contactId: string; score: number; source: string }
    | undefined
  dealReviewStatus: "needed" | "linked" | "skipped" | "none" | undefined
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : []
}

export function projectSafeMetadata(
  raw: unknown
): SafeTranscriptMetadata {
  const meta = (raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}) as Record<string, unknown>

  const cleanedTurnsRaw = Array.isArray(meta.cleanedTurns)
    ? (meta.cleanedTurns as Array<Record<string, unknown>>)
    : []
  const cleanedTurns = cleanedTurnsRaw
    .map((t) => ({
      speaker: typeof t.speaker === "string" ? t.speaker : "",
      content: typeof t.content === "string" ? t.content : "",
      startMs: typeof t.startMs === "number" ? t.startMs : 0,
      endMs: typeof t.endMs === "number" ? t.endMs : 0,
    }))

  const sigRaw = meta.extractedSignals
  const extractedSignals =
    sigRaw && typeof sigRaw === "object" && !Array.isArray(sigRaw)
      ? {
          counterpartyName: asString(
            (sigRaw as Record<string, unknown>).counterpartyName
          ),
          topic: asString((sigRaw as Record<string, unknown>).topic),
          tailSynopsis: asString(
            (sigRaw as Record<string, unknown>).tailSynopsis
          ),
        }
      : null

  const suggestionsRaw = Array.isArray(meta.suggestions)
    ? (meta.suggestions as Array<Record<string, unknown>>)
    : []
  const suggestions = suggestionsRaw
    .map((s) => ({
      contactId: typeof s.contactId === "string" ? s.contactId : "",
      score: typeof s.score === "number" ? s.score : 0,
      source: typeof s.source === "string" ? s.source : "",
      reason: typeof s.reason === "string" ? s.reason : "",
    }))
    .filter((s) => s.contactId.length > 0)

  const dealSuggestionsRaw = Array.isArray(meta.dealSuggestions)
    ? (meta.dealSuggestions as Array<Record<string, unknown>>)
    : []
  const dealSuggestions = dealSuggestionsRaw
    .map((s) => ({
      dealId: typeof s.dealId === "string" ? s.dealId : "",
      contactId: typeof s.contactId === "string" ? s.contactId : "",
      score: typeof s.score === "number" ? s.score : 0,
      source: typeof s.source === "string" ? s.source : "",
      reason: typeof s.reason === "string" ? s.reason : "",
    }))
    .filter((s) => s.dealId.length > 0)

  const afsRaw = meta.attachedFromSuggestion
  const attachedFromSuggestion =
    afsRaw && typeof afsRaw === "object" && !Array.isArray(afsRaw)
      ? {
          contactId:
            typeof (afsRaw as Record<string, unknown>).contactId === "string"
              ? ((afsRaw as Record<string, unknown>).contactId as string)
              : "",
          score:
            typeof (afsRaw as Record<string, unknown>).score === "number"
              ? ((afsRaw as Record<string, unknown>).score as number)
              : 0,
          source:
            typeof (afsRaw as Record<string, unknown>).source === "string"
              ? ((afsRaw as Record<string, unknown>).source as string)
              : "",
        }
      : undefined

  return {
    source: "plaud",
    plaudId: asString(meta.plaudId),
    plaudFilename: asString(meta.plaudFilename),
    plaudTagIds: asStringArray(meta.plaudTagIds),
    cleanedTurns,
    aiSummaryRaw: asString(meta.aiSummaryRaw),
    extractedSignals,
    aiSkipReason:
      meta.aiSkipReason === "sensitive_keywords"
        ? "sensitive_keywords"
        : undefined,
    suggestions,
    dealSuggestions,
    attachedAt: asString(meta.attachedAt) ?? undefined,
    attachedBy: asString(meta.attachedBy) ?? undefined,
    attachedFromSuggestion:
      attachedFromSuggestion && attachedFromSuggestion.contactId
        ? attachedFromSuggestion
        : undefined,
    dealReviewStatus:
      meta.dealReviewStatus === "needed" ||
      meta.dealReviewStatus === "linked" ||
      meta.dealReviewStatus === "skipped" ||
      meta.dealReviewStatus === "none"
        ? meta.dealReviewStatus
        : undefined,
  }
}
