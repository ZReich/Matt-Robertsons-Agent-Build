import { classifyEmail } from "@/lib/msgraph/email-filter"
import type {
  BehavioralHints,
  EmailAcquisitionDecision,
  EmailClassification,
  EmailFolder,
  GraphEmailMessage,
} from "@/lib/msgraph/email-types"
import { persistMessage } from "@/lib/msgraph/emails"
import { normalizeSenderAddress } from "@/lib/msgraph/sender-normalize"

import { inferDirection } from "./direction"

export interface IngestSingleBackfillMessageInput {
  message: GraphEmailMessage
  contactId: string
  targetUpn: string
  /**
   * Lower-cased addresses that count as Matt sending it (primary UPN +
   * any aliases). Used by direction inference. Optional for back-compat;
   * defaults to `[targetUpn.toLowerCase()]` when omitted.
   */
  knownSelfAddresses?: ReadonlyArray<string>
  /** Optional dealId resolved by the orchestrator from window membership. */
  dealId?: string | null
}

export interface IngestSingleBackfillMessageResult {
  /** Communication.id when freshly inserted, or null if deduped against an existing ExternalSync. */
  communicationId: string | null
  /** True when the message was already present (skipped insert). */
  deduped: boolean
  /** Classification we computed locally — useful for caller-side stats. */
  classification: EmailClassification
}

/**
 * Single-message ingest helper for the contact mailbox backfill flow.
 *
 * Reuses the live-ingest `persistMessage` so backfilled messages flow through
 * the exact same Communication insert + ExternalSync dedupe + AI scrub enqueue
 * path as live ingest. The backfill orchestrator is responsible for resolving
 * dealId from temporal window membership and passing it via `dealId`.
 */
export async function ingestSingleBackfillMessage(
  input: IngestSingleBackfillMessageInput
): Promise<IngestSingleBackfillMessageResult> {
  const { message, contactId, targetUpn, dealId } = input
  const knownSelfAddresses =
    input.knownSelfAddresses && input.knownSelfAddresses.length > 0
      ? input.knownSelfAddresses
      : [targetUpn.toLowerCase()]

  const fromAddress = message.from?.emailAddress?.address ?? null
  const direction = inferDirection({
    from: fromAddress,
    knownSelfAddresses,
  })
  const folder: EmailFolder = direction === "outbound" ? "sentitems" : "inbox"

  const normalizedSender = normalizeSenderAddress(message.from, targetUpn)

  // Backfill always operates on contacts already resolved in the system, so the
  // sender (when inbound) is by definition known. For outbound (Matt → contact)
  // the field is functionally meaningless but `true` is still correct: Matt is
  // himself, not an external sender we'd need to gate on.
  const hints: BehavioralHints = {
    senderInContacts: true,
    mattRepliedBefore: false,
    threadSize: 1,
    domainIsLargeCreBroker: false,
  }

  const classification = classifyEmail(message, {
    folder,
    normalizedSender,
    targetUpn,
    hints,
  })

  // Synthesize an EmailAcquisitionDecision so persistMessage's metadata block
  // and audit row stay schema-valid. Backfill bodies are always fetched (Graph
  // returns them with the message in the search payload), and the disposition
  // mirrors what live ingest would have recorded had this message arrived
  // through the normal pipeline.
  const acquisition: EmailAcquisitionDecision = {
    classification: classification.classification,
    source: classification.source,
    tier1Rule: classification.tier1Rule,
    ruleId: "mailbox-backfill",
    ruleVersion: 1,
    runMode: "active",
    bodyDecision: "fetch_body",
    disposition: "fetched_body",
    riskFlags: [],
    rescueFlags: [],
    evidenceSnapshot: {
      backfill: true,
      contactId,
      dealId: dealId ?? null,
    },
    rationale: "mailbox backfill — historical message ingest",
  }

  const persisted = await persistMessage({
    message,
    folder,
    normalizedSender,
    classification,
    acquisition,
    hints,
    extracted: null,
    attachments: undefined,
    attachmentFetch: undefined,
    contactId,
    leadContactId: null,
    leadCreated: false,
    dealIdOverride: dealId ?? null,
  })

  return {
    communicationId: persisted.communicationId,
    deduped: !persisted.inserted,
    classification: classification.classification,
  }
}
