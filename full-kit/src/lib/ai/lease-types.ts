/**
 * Shared types for the closed-deal classifier (Stage 1) and the lease/sale
 * extractor (Stage 2). Imported by Streams B/D/E so they don't reach into
 * each other's internals.
 *
 * The classifier is a cheap broad-scan over every Communication; the
 * extractor is only invoked on candidates that classified as `closed_lease`
 * or `closed_sale`.
 *
 * Both are routed differently:
 * - Classifier → DeepSeek (cost-cheap, OpenAI-compatible API).
 * - Extractor  → Claude Haiku (US-based model, sensitive-content-safe per
 *   Zach's 2026-04-30 decision).
 */

/**
 * The four buckets every Communication ultimately falls into. Only the
 * first two are forwarded to the lease extractor.
 */
export type ClosedDealClassificationKind =
  | "closed_lease"
  | "closed_sale"
  | "lease_in_progress"
  | "not_a_deal"

/**
 * Output of the Stage-1 classifier. `confidence` is 0–1; `signals` is a
 * short list of phrases the model latched onto (for audit and for the
 * extractor's prompt).
 */
export interface ClosedDealClassification {
  classification: ClosedDealClassificationKind
  confidence: number
  signals: string[]
}

/**
 * Output of the Stage-2 extractor. All date fields are ISO `YYYY-MM-DD`
 * strings (no timezone — leases are all-day events).
 *
 * `dealKind` is the "lease" or "sale" determination, derived from the
 * classifier output (`closed_lease` → "lease", `closed_sale` → "sale").
 * For sales, `leaseStartDate`/`leaseEndDate`/`leaseTermMonths`/`rentAmount`
 * /`rentPeriod` are all expected to be `null`.
 */
export interface LeaseExtraction {
  contactName: string
  contactEmail: string | null
  propertyAddress: string | null
  closeDate: string | null
  leaseStartDate: string | null
  leaseEndDate: string | null
  leaseTermMonths: number | null
  rentAmount: number | null
  rentPeriod: "monthly" | "annual" | null
  mattRepresented: "owner" | "tenant" | "both" | null
  dealKind: "lease" | "sale"
  confidence: number
  reasoning: string
}

/** Input fed to the AI extractor — derived from a Communication row. */
export interface LeaseExtractorInput {
  subject: string
  body: string
  /** From the upstream classifier. */
  classification: Extract<
    ClosedDealClassificationKind,
    "closed_lease" | "closed_sale"
  >
  /** Pass-through context to give the model a better starting point. */
  signals: string[]
}
