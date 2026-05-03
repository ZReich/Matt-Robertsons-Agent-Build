/**
 * Sensitive content filter.
 *
 * Matt asked on the call (2026-04-30/05-01) that we be careful about routing
 * his clients' financial data through any AI provider. Decision: emails that
 * trip these heuristics are *skipped entirely* by AI processing rather than
 * routed to a "safer" model. Skipping is the conservative choice while we
 * decide which financial workflows we trust to send to which provider.
 *
 * This filter is intentionally a) over-broad and b) cheap. False positives
 * here just mean a Communication doesn't get scrubbed/auto-replied — Matt
 * still sees it in his inbox and can act on it manually.
 */

const SENSITIVE_KEYWORDS: ReadonlyArray<string> = [
  "bank statement",
  "wire transfer",
  "wire instructions",
  "wiring instructions",
  "routing number",
  "aba routing",
  "account number",
  "checking account",
  "savings account",
  "ach authorization",
  "ach debit",
  "ach credit",
  "voided check",
  "social security",
  "ssn",
  "itin",
  "tax id",
  "ein number",
  "credit card number",
  "debit card number",
  "cvv",
  "security code",
  "passport number",
  "drivers license number",
  "driver's license number",
  "tax return",
  "1099",
  "w-9",
  "w9",
  "k-1",
  // Financial-instrument signals: lease/loan amendments often carry these and
  // belong in the "skip until human review" bucket while we figure out trust.
  "loan documents",
  "loan agreement",
  "promissory note",
]

// Match a 9-digit number that *looks* like an ABA routing number — anchored at
// word boundaries to avoid catching ZIP codes glued to addresses. Only flagged
// when paired with a banking-context word.
const ROUTING_NUMBER_PATTERN = /\b\d{9}\b/

// Match 13-19 digit sequences (allowing optional hyphens/spaces) — typical
// payment-card account length range. Only flagged when paired with a card-
// context word (card, cvv, expir, visa, mastercard, amex, discover).
const PAYMENT_CARD_PATTERN = /\b(?:\d[ -]?){12,18}\d\b/

// SSN-shaped: matches both `123-45-6789` and `123 45 6789`.
const SSN_PATTERN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/

// Note: this filter only inspects subject + body text. Attachments are not
// scanned. If/when attachment OCR / PDF parsing lands, route those through
// the same filter before AI processing. Tracked as a known gap for the
// Phase F follow-up plan.

export interface SensitivityCheckResult {
  tripped: boolean
  reasons: string[]
}

/**
 * Raw-data-only sensitivity check. Skips the broad keyword list and only
 * flags content that contains an *actual* sensitive value (SSN-shaped string,
 * routing number adjacent to banking words, payment card in card context).
 *
 * Used by bulk read-only scans (criteria backfill, summarization) where the
 * default broad filter rejects too many normal CRE emails for incidentally
 * mentioning words like "tax return" or "checking account."
 *
 * The default `containsSensitiveContent` (broad) is still used for any
 * write-side AI path (scrub queue, auto-reply generation).
 */
// Slim denylist for the strict variant — limited to phrases that almost
// never show up in routine CRE prospecting threads. The broad list above
// (with "tax return", "1099", "checking account", etc.) over-flags normal
// CRE lingo and was rejecting 80%+ of valid contacts during backfill.
const STRICT_KEYWORD_DENYLIST: ReadonlyArray<string> = [
  "ssn",
  "social security",
  "wire instructions",
  "wiring instructions",
  "wire transfer",
  "voided check",
  "ach debit",
  "ach credit",
  "ach authorization",
  "routing number",
  "bank account",
  "credit card number",
  "card ending in",
]

export function containsRawSensitiveData(
  subject: string | null | undefined,
  body: string | null | undefined
): SensitivityCheckResult {
  const reasons: string[] = []
  const haystack = `${subject ?? ""}\n${body ?? ""}`.toLowerCase()

  for (const kw of STRICT_KEYWORD_DENYLIST) {
    if (haystack.includes(kw)) {
      reasons.push(`keyword:${kw}`)
    }
  }

  if (SSN_PATTERN.test(haystack)) {
    reasons.push("pattern:ssn")
  }
  // Treat any 9-digit run paired with banking-context phrasing as a routing
  // number. Broadened keyword set to catch "ach", "account", "bank", and
  // "wire" without requiring the literal phrase.
  if (ROUTING_NUMBER_PATTERN.test(haystack)) {
    if (
      haystack.includes("routing") ||
      haystack.includes("aba") ||
      haystack.includes("wire") ||
      haystack.includes("ach ") ||
      haystack.includes("bank ") ||
      haystack.includes(" account ")
    ) {
      reasons.push("pattern:routing_number_in_banking_context")
    }
  }
  // Card-context broadened to catch "card 4111...", "charge my card", etc.
  if (PAYMENT_CARD_PATTERN.test(haystack)) {
    if (
      haystack.includes("cvv") ||
      haystack.includes("card") ||
      haystack.includes("expir") ||
      haystack.includes("visa") ||
      haystack.includes("mastercard") ||
      haystack.includes("amex") ||
      haystack.includes("discover")
    ) {
      reasons.push("pattern:payment_card_in_card_context")
    }
  }

  return { tripped: reasons.length > 0, reasons }
}

export function containsSensitiveContent(
  subject: string | null | undefined,
  body: string | null | undefined
): SensitivityCheckResult {
  const reasons: string[] = []
  const haystack = `${subject ?? ""}\n${body ?? ""}`.toLowerCase()

  for (const keyword of SENSITIVE_KEYWORDS) {
    if (haystack.includes(keyword)) {
      reasons.push(`keyword:${keyword}`)
      // Don't break — useful to see all the reasons in audit logs.
    }
  }

  if (SSN_PATTERN.test(haystack)) {
    reasons.push("pattern:ssn")
  }

  // Routing number pattern is super noisy alone (any 9-digit string trips
  // it), so only count it when paired with a banking-ish context word.
  if (ROUTING_NUMBER_PATTERN.test(haystack)) {
    if (
      haystack.includes("routing") ||
      haystack.includes("bank") ||
      haystack.includes("aba")
    ) {
      reasons.push("pattern:routing_number_in_banking_context")
    }
  }

  if (PAYMENT_CARD_PATTERN.test(haystack)) {
    // Same idea — a long digit run alone could be a UPC; only flag when paired
    // with payment-context words.
    if (
      haystack.includes("card") ||
      haystack.includes("cvv") ||
      haystack.includes("expir") ||
      haystack.includes("visa") ||
      haystack.includes("mastercard") ||
      haystack.includes("amex") ||
      haystack.includes("discover")
    ) {
      reasons.push("pattern:payment_card_in_card_context")
    }
  }

  return { tripped: reasons.length > 0, reasons }
}

export const SENSITIVE_FILTER_VERSION = "2026-05-01.1"
