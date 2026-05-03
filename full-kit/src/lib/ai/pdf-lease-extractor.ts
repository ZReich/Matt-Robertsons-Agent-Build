import "server-only"

import type Anthropic from "@anthropic-ai/sdk"

import { createAnthropicClient } from "./claude"
import {
  EXTRACT_TOOL,
  estimateExtractorUsd,
  LEASE_EXTRACTOR_VERSION,
  loadLeaseExtractorPrompt,
  resolveExtractorModel,
  validateLeaseExtraction,
} from "./lease-extractor"
import type { LeaseExtraction } from "./lease-types"
import {
  logScrubApiCall,
  type ScrubApiOutcome,
  type ScrubApiUsage,
} from "./scrub-api-log"

/**
 * Stage-2 lease/sale extractor — PDF fallback path.
 *
 * Most closed-deal emails carry the executed lease as a PDF attachment
 * rather than inline text. The body extractor (`callExtractor` in
 * `lease-extractor.ts`) only sees the email body, so it routinely
 * returns null/low-confidence on those messages — even though the dates
 * and rent are right there in the attachment.
 *
 * This module accepts a PDF Buffer and ships it to Claude Haiku via the
 * Anthropic SDK's native PDF-input support (a `document` content block
 * with a `base64` source). The system prompt and `EXTRACT_TOOL` schema
 * are reused verbatim from the body extractor — no fork, no drift.
 *
 * The orchestrator (Task 2.3, separate dispatch) is what decides when
 * to call us: body extractor first, fall through to PDF only when the
 * body returns null and a PDF attachment is present.
 *
 * Telemetry: every call writes a `ScrubApiCall` row, including skips
 * (file_too_large / not_pdf), so the skip rate is queryable.
 */

/**
 * Anthropic's PDF input cap. The Messages API rejects requests over
 * 32MB outright; we short-circuit before paying for the SDK round trip.
 * Source: docs.anthropic.com/en/docs/build-with-claude/pdf-support.
 */
const MAX_PDF_BYTES = 32 * 1024 * 1024

/** PDF magic bytes (`%PDF-`). Anything else is rejected pre-flight. */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d])

export interface PdfLeaseExtractorInput {
  pdf: Buffer
  classification: "closed_lease" | "closed_sale"
  signals: string[]
  subject: string
  /**
   * Optional excerpt of the email body that came with the PDF. Threaded
   * into the user message so the model has the surrounding context
   * (subject + signals + body excerpt + PDF). When absent, we send a
   * sentinel string to make that explicit to the model.
   */
  bodyExcerpt?: string
}

export type PdfLeaseExtractorOutcome =
  | { ok: true; result: LeaseExtraction; modelUsed: string }
  | {
      ok: false
      reason:
        | "file_too_large"
        | "not_pdf"
        | "stub_no_response"
        | "validation_failed"
        | "provider_error"
      details?: string
    }

/**
 * Telemetry-write wrapper. Always swallows errors — losing a row of
 * telemetry is preferred over losing a successful extraction. Mirrors
 * the body extractor's pattern.
 */
async function writePdfExtractorLog(args: {
  modelUsed: string
  usage: ScrubApiUsage
  outcome: Extract<
    ScrubApiOutcome,
    | "extractor-pdf-ok"
    | "extractor-pdf-validation-failed"
    | "extractor-pdf-provider-error"
    | "extractor-pdf-skipped"
  >
}): Promise<void> {
  try {
    await logScrubApiCall({
      promptVersion: LEASE_EXTRACTOR_VERSION,
      modelUsed: args.modelUsed,
      usage: args.usage,
      outcome: args.outcome,
      // Skips are zero-cost; success/error use the same Haiku pricing
      // as the body extractor — by design (spec acceptance: "no new
      // pricing constants").
      estimatedUsdOverride: estimateExtractorUsd(args.usage),
    })
  } catch (err) {
    console.error("[extractor-pdf] failed to write ScrubApiCall row:", err)
  }
}

function buildUserText(input: PdfLeaseExtractorInput): string {
  const body =
    input.bodyExcerpt && input.bodyExcerpt.trim().length > 0
      ? input.bodyExcerpt
      : "(extracted from PDF only — no body excerpt)"
  return (
    `SUBJECT:\n${input.subject}\n\n` +
    `BODY:\n${body}\n\n` +
    `CLASSIFICATION: ${input.classification}\n` +
    `SIGNALS: ${JSON.stringify(input.signals)}`
  )
}

/**
 * Run the PDF lease extractor. Returns `{ok: true, result}` on
 * validated success, or a structured `{ok: false, reason}` on every
 * failure mode. Never re-throws — the orchestrator treats each `reason`
 * (including `provider_error`) as a terminal-but-recoverable state.
 *
 * Skip cases (`file_too_large`, `not_pdf`) are logged with a zero-cost
 * `extractor-pdf-skipped` telemetry row so we can graph how often we
 * refuse to ship a payload to Anthropic.
 *
 * Pricing assumption (spec, 2026-05-02): Anthropic bills PDF input at
 * the same per-token rate as text (~1500-3000 tokens per page after
 * their internal vision processing). We pass the response's actual
 * `usage` numbers through `estimateExtractorUsd` (Haiku 4.5 rates) — no
 * new pricing constants.
 */
export async function extractLeaseFromPdf(
  input: PdfLeaseExtractorInput
): Promise<PdfLeaseExtractorOutcome> {
  const model = resolveExtractorModel()

  // 1. Size cap — short-circuit so we never pay the SDK round trip on
  // a payload Anthropic would reject anyway.
  if (input.pdf.length > MAX_PDF_BYTES) {
    await writePdfExtractorLog({
      modelUsed: model,
      usage: { tokensIn: 0, tokensOut: 0 },
      outcome: "extractor-pdf-skipped",
    })
    return {
      ok: false,
      reason: "file_too_large",
      details: `pdf is ${input.pdf.length} bytes (cap ${MAX_PDF_BYTES})`,
    }
  }

  // 2. Magic-byte sniff. Strict on the first 5 bytes — we don't tolerate
  // leading whitespace because (a) Outlook never produces that and (b)
  // a "PDF" without `%PDF-` at offset 0 is almost certainly a renamed
  // .docx or HTML body wrapped in a .pdf extension.
  if (
    input.pdf.length < PDF_MAGIC.length ||
    !input.pdf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
  ) {
    await writePdfExtractorLog({
      modelUsed: model,
      usage: { tokensIn: 0, tokensOut: 0 },
      outcome: "extractor-pdf-skipped",
    })
    return { ok: false, reason: "not_pdf" }
  }

  const promptBody = await loadLeaseExtractorPrompt()
  const userText = buildUserText(input)

  // 3. Build the Messages request. Reuses the SAME EXTRACT_TOOL and
  // prompt MD as the body extractor — single source of truth.
  const client = createAnthropicClient()

  let response: Awaited<ReturnType<typeof client.messages.create>>
  try {
    response = await client.messages.create({
      model,
      max_tokens: 1024,
      temperature: 0,
      system: [
        {
          type: "text",
          text: promptBody,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: "tool", name: "extract_lease" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: input.pdf.toString("base64"),
              },
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    })
  } catch (err) {
    await writePdfExtractorLog({
      modelUsed: model,
      usage: { tokensIn: 0, tokensOut: 0 },
      outcome: "extractor-pdf-provider-error",
    })
    return {
      ok: false,
      reason: "provider_error",
      details: err instanceof Error ? err.message : String(err),
    }
  }

  const message = response as Anthropic.Messages.Message
  const usage: ScrubApiUsage = {
    tokensIn: message.usage?.input_tokens ?? 0,
    tokensOut: message.usage?.output_tokens ?? 0,
    cacheReadTokens:
      (message.usage as { cache_read_input_tokens?: number } | undefined)
        ?.cache_read_input_tokens ?? 0,
    cacheWriteTokens:
      (message.usage as { cache_creation_input_tokens?: number } | undefined)
        ?.cache_creation_input_tokens ?? 0,
  }
  const modelUsed = message.model ?? model

  const toolUse = message.content?.find(
    (block) => block.type === "tool_use" && block.name === "extract_lease"
  )

  if (!toolUse || toolUse.type !== "tool_use") {
    // No usable structured output. Same outcome bucket as body
    // extractor's null-tool-use path (validation-failed family) so the
    // dashboard query lines up.
    await writePdfExtractorLog({
      modelUsed,
      usage,
      outcome: "extractor-pdf-validation-failed",
    })
    return { ok: false, reason: "stub_no_response" }
  }

  // 4. Validate against the same schema rules as the body extractor.
  const expectedDealKind: "lease" | "sale" =
    input.classification === "closed_lease" ? "lease" : "sale"
  const validation = validateLeaseExtraction(toolUse.input, expectedDealKind)
  if (!validation.ok) {
    await writePdfExtractorLog({
      modelUsed,
      usage,
      outcome: "extractor-pdf-validation-failed",
    })
    return {
      ok: false,
      reason: "validation_failed",
      details: validation.reason,
    }
  }

  await writePdfExtractorLog({
    modelUsed,
    usage,
    outcome: "extractor-pdf-ok",
  })

  return { ok: true, result: validation.value, modelUsed }
}
