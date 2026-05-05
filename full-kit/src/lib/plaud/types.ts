/**
 * Shared types for the Plaud integration.
 *
 * These map to a stable internal shape (camelCase, ms-precise dates as Date
 * objects) — the HTTP layer translates raw upstream responses (snake_case,
 * epoch-ms ints, mixed types) into these. Callers above the client never
 * see the upstream shape.
 */

export type PlaudRegion = "us" | "eu" | "ap"

export const PLAUD_BASE_URLS: Record<PlaudRegion, string> = {
  us: "https://api.plaud.ai",
  eu: "https://api-euc1.plaud.ai",
  ap: "https://api-apse1.plaud.ai",
}

export interface PlaudRecordingTurn {
  speaker: string
  content: string
  startMs: number
  endMs: number
}

/**
 * Recording metadata as returned by `GET /file/simple/web` — no transcript.
 * `durationSeconds` is computed from upstream `duration` (which is in ms).
 *
 * Trashed recordings (`is_trash=1`) are filtered at the HTTP layer; this
 * shape never represents a trashed item.
 */
export interface PlaudRecording {
  id: string
  filename: string
  filesize: number
  durationSeconds: number
  startTime: Date
  endTime: Date | null
  isTranscribed: boolean
  isSummarized: boolean
  /** Plaud calls these "filetags" / "tags" — they're folder-like but the
   * upstream field is `filetag_id_list`. Use this to map to a contact via
   * the user's per-tag → contact mapping. */
  tagIds: string[]
  keywords: string[]
}

/**
 * Full transcript detail — fetched via `POST /file/list` with `[id]`.
 *
 * `aiContentRaw` is whatever Plaud put in `ai_content`. It may be plain
 * markdown OR a JSON-wrapped string with shapes like `{"markdown": "..."}`,
 * `{"content": {"markdown": "..."}}`, or `{"summary": "..."}`. Use
 * `parseAiContent()` (in `client.ts`) to normalize before display.
 */
export interface PlaudTranscript {
  recordingId: string
  turns: PlaudRecordingTurn[]
  aiContentRaw: string | null
  summaryList: string[]
}

export interface ExtractedSignals {
  counterpartyName: string | null
  topic: string | null
  mentionedCompanies: string[]
  mentionedProperties: string[]
  tailSynopsis: string | null
}

export type MatchSource =
  | "tail_synopsis"
  | "counterparty_candidate"
  | "filename"
  | "folder_tag"
  | "meeting_proximity"
  | "transcript_open"

export interface MatchSuggestion {
  contactId: string
  score: number
  reason: string
  source: MatchSource
}

/**
 * Deal-level suggestion. Scored on cross-references from extracted
 * signals: mentionedProperties hit Deal.propertyAddress / propertyAliases,
 * counterpartyName hits the deal's primary contact, and topic-level
 * substring matches against the address. Surfaced as a separate panel
 * in the UI so Matt can attach the transcript to the deal's timeline
 * (Communication.dealId) — the underlying Communication can be linked
 * to a contact AND a deal at the same time.
 */
export type DealMatchSource =
  | "mentioned_property"
  | "deal_contact_name"
  | "topic_keyword"

export interface DealMatchSuggestion {
  dealId: string
  contactId: string
  score: number
  reason: string
  source: DealMatchSource
}
