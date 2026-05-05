import type {
  ExtractedSignals,
  MatchSource,
  MatchSuggestion,
  PlaudRecording,
} from "./types"

export interface ContactRef {
  id: string
  fullName: string
  aliases: string[]
}

export interface MatcherInput {
  recording: PlaudRecording
  cleanedText: string
  extractedSignals: ExtractedSignals
  contacts: ContactRef[]
  scheduledMeetings: Array<{ contactId: string; date: Date }>
  /**
   * Per-Plaud-tag → contact-id mapping (Matt configures via the UI).
   * Plaud calls these "filetags" but they're folder-like in the app.
   */
  tagToContactMap: Record<string, string>
}

/**
 * Pure match suggester. Given a single recording, the cleaned text, the
 * AI-extracted signals, and the user's contact corpus, return up to 3
 * confidence-tiered suggestions.
 *
 * Suggest-only: nothing here writes to the DB. The orchestrator stores
 * these on the Communication.metadata.suggestions blob for the UI to
 * display. Matt's click is required to attach a suggestion to a contact.
 */

const SOURCE_ORDER: ReadonlyArray<MatchSource> = [
  "tail_synopsis",
  "filename",
  "folder_tag",
  "meeting_proximity",
  "transcript_open",
]

const SOURCE_RANK: Record<MatchSource, number> = SOURCE_ORDER.reduce(
  (acc, src, i) => {
    acc[src] = SOURCE_ORDER.length - i
    return acc
  },
  {} as Record<MatchSource, number>
)

const HIGH_PROXIMITY_MS = 15 * 60 * 1000
const LOW_PROXIMITY_MS = 60 * 60 * 1000
const MIN_NAME_TOKEN_LEN = 3
const TRIGRAM_MATCH_THRESHOLD = 0.85
const OPENING_PREFIX_LEN = 200
// Cap the haystack we search to keep matching fast even when an attacker
// passes a 1MB counterpartyName.
const MAX_HAYSTACK_LEN = 4096

/**
 * Lowercase + replace anything that isn't a-z0-9 with a single space.
 * Crucially, this strips regex metacharacters before any string ops, so
 * a malicious extracted name like `.*Bob` is normalized to ` bob` — we
 * don't pass user input to a RegExp constructor anywhere.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(s: string): string[] {
  return normalize(s).slice(0, MAX_HAYSTACK_LEN).split(" ").filter(Boolean)
}

/**
 * Score how strongly `needle` (a contact name or alias) appears in
 * `haystack` (an extracted name, filename, or transcript opening).
 *
 *   1.00 → needle's token sequence appears contiguously in haystack
 *   t/N  → t of N significant tokens (≥3 chars) of needle appear as
 *          WHOLE tokens in haystack (so "Bob" doesn't match "lobby")
 *   0    → otherwise
 *
 * Token-level matching, not raw substring, to avoid false positives
 * like a contact named "Bob" matching the word "lobby".
 */
function nameMatchScore(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0
  const n = tokenize(needle)
  const h = tokenize(haystack)
  if (n.length === 0 || h.length === 0) return 0

  // Subsequence-of-tokens check: full needle present as contiguous tokens.
  if (n.length <= h.length) {
    for (let i = 0; i <= h.length - n.length; i++) {
      let allMatch = true
      for (let j = 0; j < n.length; j++) {
        if (h[i + j] !== n[j]) {
          allMatch = false
          break
        }
      }
      if (allMatch) return 1.0
    }
  }

  // Partial: significant tokens that appear as whole tokens in haystack.
  const sig = n.filter((t) => t.length >= MIN_NAME_TOKEN_LEN)
  if (sig.length === 0) return 0
  const hSet = new Set(h)
  const hits = sig.filter((t) => hSet.has(t)).length
  return hits / sig.length
}

/**
 * Find the best contact match against `text`. Returns null when the
 * top score is below `threshold` OR when multiple contacts tie at the
 * top score (ambiguous → suppress the suggestion entirely, matching
 * the meeting-proximity rule).
 */
function matchAgainstContacts(
  text: string,
  contacts: ContactRef[],
  threshold: number = TRIGRAM_MATCH_THRESHOLD
): { contact: ContactRef; score: number } | null {
  if (!text) return null
  let best: { contact: ContactRef; score: number } | null = null
  let tiedAtBest = false
  for (const c of contacts) {
    if (!c.fullName && (!c.aliases || c.aliases.length === 0)) continue
    const candidates = [c.fullName, ...c.aliases].filter(Boolean)
    let contactBest = 0
    for (const cand of candidates) {
      const score = nameMatchScore(cand, text)
      if (score > contactBest) contactBest = score
    }
    if (contactBest < threshold) continue
    if (!best || contactBest > best.score) {
      best = { contact: c, score: contactBest }
      tiedAtBest = false
    } else if (contactBest === best.score && c.id !== best.contact.id) {
      tiedAtBest = true
    }
  }
  if (tiedAtBest) return null
  return best
}

// Tail synopsis is high-confidence (Matt explicitly names the person), so
// require a near-full name match. Filename / opening can hit on a partial
// name ("Sarah lease talk" → c-sarah) so use a looser threshold.
const SYNOPSIS_THRESHOLD = 0.85
const PARTIAL_THRESHOLD = 0.5

export function suggestContacts(input: MatcherInput): MatchSuggestion[] {
  const all: MatchSuggestion[] = []

  // 1. Tail synopsis (or counterpartyName) → fuzzy contact match
  const synopsisText =
    input.extractedSignals.tailSynopsis ??
    input.extractedSignals.counterpartyName ??
    ""
  if (synopsisText) {
    const m = matchAgainstContacts(
      synopsisText,
      input.contacts,
      SYNOPSIS_THRESHOLD
    )
    if (m) {
      all.push({
        contactId: m.contact.id,
        score: 90 + Math.round(m.score * 10),
        reason: `matched "${m.contact.fullName}" from your end-of-call synopsis`,
        source: "tail_synopsis",
      })
    }
  }

  // 2. Filename
  if (input.recording.filename) {
    const m = matchAgainstContacts(
      input.recording.filename,
      input.contacts,
      PARTIAL_THRESHOLD
    )
    if (m) {
      all.push({
        contactId: m.contact.id,
        score: 60 + Math.round(m.score * 25),
        reason: `recording title "${input.recording.filename}" mentions "${m.contact.fullName}"`,
        source: "filename",
      })
    }
  }

  // 3. Tag map (Plaud "filetag" → contact). Defensive ?? in case an upstream
  // shape change makes tagIds undefined.
  for (const tagId of input.recording.tagIds ?? []) {
    const contactId = input.tagToContactMap[tagId]
    if (!contactId) continue
    const c = input.contacts.find((x) => x.id === contactId)
    if (c) {
      all.push({
        contactId: c.id,
        score: 70,
        reason: `recording tagged "${tagId}", which you've mapped to "${c.fullName}"`,
        source: "folder_tag",
      })
    }
  }

  // 4. Meeting proximity. Only emit a suggestion when EXACTLY ONE meeting
  // falls in the 60-min window — multiple matches are ambiguous and we
  // prefer to surface no suggestion over a wrong one.
  const recordingMs = input.recording.startTime.getTime()
  const inWindow = input.scheduledMeetings
    .map((m) => ({ ...m, diffMs: Math.abs(m.date.getTime() - recordingMs) }))
    .filter((m) => m.diffMs < LOW_PROXIMITY_MS)
  if (inWindow.length === 1) {
    const only = inWindow[0]
    const c = input.contacts.find((x) => x.id === only.contactId)
    if (c) {
      const score = only.diffMs < HIGH_PROXIMITY_MS ? 70 : 50
      all.push({
        contactId: c.id,
        score,
        reason: `recording started within ${Math.round(
          only.diffMs / 60_000
        )} min of a scheduled meeting with "${c.fullName}"`,
        source: "meeting_proximity",
      })
    }
  }

  // 5. Transcript opening — first ~200 chars NLP-style match.
  if (input.cleanedText) {
    const opening = input.cleanedText.slice(0, OPENING_PREFIX_LEN)
    const m = matchAgainstContacts(
      opening,
      input.contacts,
      PARTIAL_THRESHOLD
    )
    if (m) {
      all.push({
        contactId: m.contact.id,
        score: 30 + Math.round(m.score * 20),
        reason: `transcript opening mentions "${m.contact.fullName}"`,
        source: "transcript_open",
      })
    }
  }

  // Dedupe by contactId, taking highest source rank then highest score.
  const byContact = new Map<string, MatchSuggestion>()
  for (const s of all) {
    const existing = byContact.get(s.contactId)
    if (
      !existing ||
      SOURCE_RANK[s.source] > SOURCE_RANK[existing.source] ||
      (SOURCE_RANK[s.source] === SOURCE_RANK[existing.source] &&
        s.score > existing.score)
    ) {
      byContact.set(s.contactId, s)
    }
  }
  return Array.from(byContact.values())
    .sort(
      (a, b) =>
        SOURCE_RANK[b.source] - SOURCE_RANK[a.source] || b.score - a.score
    )
    .slice(0, 3)
}
