import { generatePendingReply } from "@/lib/ai/auto-reply"
import { containsSensitiveContent } from "@/lib/ai/sensitive-filter"
import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "@/lib/msgraph/email-extractors"
import { sendMailAsMatt } from "@/lib/msgraph/send-mail"
import { db } from "@/lib/prisma"
import { getAutomationSettings } from "@/lib/system-state/automation-settings"

/**
 * Phase E (2026-05-02 deal-pipeline-automation plan): when a contact-promotion
 * candidate is approved into a Lead, optionally fire generatePendingReply for
 * the inbound communication if it references a Property in the catalog.
 *
 * The whole flow is wrapped in try/catch — failures here MUST NOT block the
 * candidate-approval API response. Caller should fire-and-forget after the
 * candidate transaction commits.
 */

export type AutoReplyHookResult =
  | { status: "fired"; pendingReplyId: string; sent: boolean }
  | {
      status: "skipped"
      reason:
        | "no-communication"
        | "no-property-key"
        | "no-property-match"
        | "auto-reply-failed"
        | "duplicate-pending-reply"
        | "sensitive-content"
    }
  | { status: "errored"; error: string }

export interface AutoReplyHookInput {
  communicationId: string | null | undefined
  contactId: string
  contactEmail: string | null | undefined
  contactName: string | null | undefined
}

const APPROVED_BY_LABEL = "auto-send-new-lead-reply"

export async function maybeFireAutoReplyForApprovedLead(
  input: AutoReplyHookInput
): Promise<AutoReplyHookResult> {
  try {
    if (!input.communicationId) {
      return { status: "skipped", reason: "no-communication" }
    }

    const comm = await db.communication.findUnique({
      where: { id: input.communicationId },
      select: { id: true, subject: true, body: true, metadata: true },
    })
    if (!comm) {
      return { status: "skipped", reason: "no-communication" }
    }

    // Defense in depth — generatePendingReply also gates on this, but we want
    // to short-circuit before doing any work (and avoid even fetching/looking
    // up the Property catalog for sensitive emails).
    const sensitivity = containsSensitiveContent(comm.subject, comm.body)
    if (sensitivity.tripped) {
      return { status: "skipped", reason: "sensitive-content" }
    }

    const propertyKey = resolvePropertyKey(comm)
    if (!propertyKey) {
      return { status: "skipped", reason: "no-property-key" }
    }

    const property = await db.property.findFirst({
      where: { propertyKey, archivedAt: null },
      orderBy: [{ unit: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      select: { id: true },
    })
    if (!property) {
      return { status: "skipped", reason: "no-property-match" }
    }

    // Idempotency: if there's already a PendingReply for this exact
    // (trigger, contact, property) tuple, don't duplicate. NOTE: this is
    // application-only dedupe — under heavily concurrent re-fires (very
    // unlikely path; the candidate-approval tx's advisory lock + idempotent
    // flag already gate practical races) two PendingReply rows could still
    // race in. The durable fix is a partial unique index on
    // (triggerCommunicationId, contactId, propertyId); deferred to a future
    // migration batch.
    const existing = await db.pendingReply.findFirst({
      where: {
        triggerCommunicationId: comm.id,
        contactId: input.contactId,
        propertyId: property.id,
      },
      select: { id: true },
    })
    if (existing) {
      return { status: "skipped", reason: "duplicate-pending-reply" }
    }

    const draft = await generatePendingReply({
      triggerCommunicationId: comm.id,
      contactId: input.contactId,
      propertyId: property.id,
      outreachKind: "inbound_inquiry",
      persist: true,
    })

    if (!draft.ok) {
      return { status: "skipped", reason: "auto-reply-failed" }
    }
    if (!draft.pendingReplyId) {
      // persist:true should always return an id; defensive fallback.
      return { status: "skipped", reason: "auto-reply-failed" }
    }

    const pendingReplyId = draft.pendingReplyId

    const settings = await getAutomationSettings()
    if (!settings.autoSendNewLeadReplies || !input.contactEmail) {
      return { status: "fired", pendingReplyId, sent: false }
    }

    const sendResult = await sendMailAsMatt({
      subject: draft.draft.subject,
      body: draft.draft.body,
      contentType: "Text",
      toRecipients: [
        {
          address: input.contactEmail,
          ...(input.contactName ? { name: input.contactName } : {}),
        },
      ],
      saveToSentItems: true,
    })

    if (sendResult.ok) {
      await db.pendingReply.update({
        where: { id: pendingReplyId },
        data: {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: APPROVED_BY_LABEL,
        },
      })
      return { status: "fired", pendingReplyId, sent: true }
    }

    // Send failed — leave the PendingReply in draft so it shows up in the
    // review queue and a human can retry. Surface a console warning so the
    // failure is observable in server logs.
    console.warn(
      `[contact-promotion-auto-reply] auto-send failed for pendingReply ${pendingReplyId}: ${sendResult.reason}${sendResult.details ? " — " + sendResult.details : ""}`
    )
    return { status: "fired", pendingReplyId, sent: false }
  } catch (err) {
    return {
      status: "errored",
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function resolvePropertyKey(comm: {
  subject: string | null
  body: string | null
  metadata: unknown
}): string | null {
  // 1. Stamped propertyKey from the original ingest extractor (preferred).
  const stamped = readStampedPropertyKey(comm.metadata)
  if (stamped) return stamped

  // 2. Re-run extractors against subject+body. Try in source-hint order if
  //    metadata.source / sender suggests a platform; otherwise try all three.
  const subject = comm.subject ?? ""
  const bodyText = comm.body ?? ""
  const input = { subject, bodyText }
  const sourceHint = readMetadataSource(comm.metadata)

  const extractors = orderExtractors(sourceHint)
  for (const extractor of extractors) {
    const result = extractor(input)
    if (result && "propertyKey" in result && result.propertyKey) {
      return result.propertyKey
    }
  }
  return null
}

function readStampedPropertyKey(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const m = metadata as Record<string, unknown>
  const top = typeof m.propertyKey === "string" ? m.propertyKey.trim() : ""
  if (top) return top
  const extracted = m.extracted
  if (
    extracted &&
    typeof extracted === "object" &&
    !Array.isArray(extracted)
  ) {
    const e = extracted as Record<string, unknown>
    const nested = typeof e.propertyKey === "string" ? e.propertyKey.trim() : ""
    if (nested) return nested
  }
  return null
}

function readMetadataSource(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const m = metadata as Record<string, unknown>
  if (typeof m.source === "string") return m.source.toLowerCase()
  return null
}

type ExtractorFn = (input: {
  subject: string
  bodyText: string
}) => { propertyKey?: string } | null

function orderExtractors(sourceHint: string | null): ExtractorFn[] {
  const all: Array<[string, ExtractorFn]> = [
    ["loopnet", extractLoopNetLead],
    ["crexi", extractCrexiLead],
    ["buildout", extractBuildoutEvent],
  ]
  if (!sourceHint) return all.map(([, fn]) => fn)
  const matched = all.filter(([key]) => sourceHint.includes(key))
  const rest = all.filter(([key]) => !sourceHint.includes(key))
  return [...matched, ...rest].map(([, fn]) => fn)
}
