import type { DealStage } from "@prisma/client"
import type { BuyerRepSignalType } from "./buyer-rep-detector"

import { db } from "@/lib/prisma"

export type ProposeBuyerRepInput = {
  communicationId: string
  // At least ONE of contactId / recipientEmail must be set. The hook
  // tries to match an existing Contact by recipient email; if it finds
  // one, contactId is set. Otherwise recipientEmail flows through to
  // approval-time resolution (find-or-create Contact in createDealFromAction).
  contactId?: string | null
  recipientEmail?: string | null
  recipientDisplayName?: string | null
  signalType: BuyerRepSignalType
  proposedStage: DealStage
  confidence: number
}

export type ProposeBuyerRepTier = "auto" | "approve" | "log_only"

export type ProposeBuyerRepResult = {
  created: boolean
  actionId: string | null
  tier?: ProposeBuyerRepTier
  skipReason?: "existing-buyer-rep-deal" | "duplicate-pending-action"
}

// Window for "is there already a pending create-deal action for this
// (recipientEmail, signalType, [contactId])?" dedupe. The Phase 7 audit found
// 306 pending rows collapsing to 83 distinct (recipientEmail, signalType)
// pairs — many were created within days of each other from a thread of
// outbound LOIs/tours. 90 days catches that pattern without permanently
// blocking a legitimate re-engagement after a long gap.
const PENDING_DEDUPE_WINDOW_DAYS = 90

// Phase D step 3: filename match for promoting LOI proposals to tier=auto.
// Anchored on the most reliable broker/lawyer naming conventions for
// transactional docs. Case-insensitive — file systems vary, and Outlook
// often re-cases attachment names on download.
const LOI_FILENAME_RE = /loi|letter[-_ ]of[-_ ]intent|offer/i

type AttachmentLike = { name?: unknown }

function hasLoiAttachment(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false
  const md = metadata as { attachments?: unknown }
  const list = md.attachments
  if (!Array.isArray(list)) return false
  for (const att of list as AttachmentLike[]) {
    const name = att?.name
    if (typeof name === "string" && LOI_FILENAME_RE.test(name)) return true
  }
  return false
}

export async function proposeBuyerRepDeal(
  input: ProposeBuyerRepInput
): Promise<ProposeBuyerRepResult> {
  if (!input.contactId && !input.recipientEmail) {
    throw new Error(
      "proposeBuyerRepDeal requires at least one of contactId or recipientEmail"
    )
  }

  return await db.$transaction(async (tx) => {
    // Phase D step 3: tenant_rep_search is a pure audit row. It does NOT
    // dedupe (multiple log-only rows for the same contact across different
    // emails are useful — they show the user is talking to many brokers),
    // and it ships with status=executed so it never appears in the approval
    // queue. We bypass the advisory lock + dedupe path entirely.
    if (input.signalType === "tenant_rep_search") {
      const reason = `Buyer-rep ${input.signalType} signal detected with confidence ${input.confidence}`
      const action = await tx.agentAction.create({
        data: {
          actionType: "create-deal",
          status: "executed",
          tier: "log_only",
          summary: `Audit: ${input.signalType} signal at ${input.proposedStage}`,
          sourceCommunicationId: input.communicationId,
          payload: {
            contactId: input.contactId ?? null,
            recipientEmail: input.recipientEmail ?? null,
            recipientDisplayName: input.recipientDisplayName ?? null,
            dealType: "buyer_rep",
            dealSource: "buyer_rep_inferred",
            stage: input.proposedStage,
            signalType: input.signalType,
            confidence: input.confidence,
            reason,
            auditOnly: true,
          },
        },
      })
      return {
        created: true,
        actionId: action.id,
        tier: "log_only" as const,
      }
    }

    // Postgres advisory lock keyed on the proposer's identity (email or
    // contactId). Two concurrent callers (live ingest + manual sweep, or two
    // sweep retries on the same recipient/signal) serialize here so the
    // existence + dedupe reads aren't racy. Cheap and idempotent — same
    // pattern as buildout-stage-action.ts.
    const lockKey = `${(input.recipientEmail ?? "").toLowerCase()}|${input.contactId ?? ""}|${input.signalType}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

    // 1. Resolve the effective contact. If contactId was passed, use it; else
    //    try to look up a non-archived Contact by recipientEmail
    //    (case-insensitive). If no contact resolves, we still run the
    //    pending-AgentAction dedupe by email — but skip the Deal-existence
    //    check (which requires a contactId).
    let effectiveContactId: string | null = input.contactId ?? null
    if (!effectiveContactId && input.recipientEmail) {
      const found = (await tx.contact.findFirst({
        where: {
          email: { equals: input.recipientEmail, mode: "insensitive" },
          archivedAt: null,
        },
        select: { id: true },
      })) as { id: string } | null
      if (found) effectiveContactId = found.id
    }

    // 2. Existing-Deal guard. If there's already a non-archived buyer_rep
    //    Deal for this contact, skip. (Different dealType / archived deals
    //    don't count — the where clause filters them out.)
    if (effectiveContactId) {
      const existingDeal = await tx.deal.findFirst({
        where: {
          contactId: effectiveContactId,
          dealType: "buyer_rep",
          archivedAt: null,
        },
        select: { id: true },
      })
      if (existingDeal) {
        return {
          created: false,
          actionId: null,
          skipReason: "existing-buyer-rep-deal" as const,
        }
      }
    }

    // 3. Pending-AgentAction dedupe. Match the same (recipientEmail,
    //    signalType) pair within the dedupe window. The existing 306 rows in
    //    production carry payload.contactId = null, so we deliberately match
    //    on email regardless of whether effectiveContactId resolved. If the
    //    pending row also stored a contactId in its payload, we still want
    //    to short-circuit so naive-approving wouldn't mint a second deal.
    const cutoff = new Date(
      Date.now() - PENDING_DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )
    const lowerEmail = input.recipientEmail
      ? input.recipientEmail.toLowerCase()
      : null

    if (lowerEmail || effectiveContactId) {
      // Build an OR-clause: dedupe matches if EITHER the recipientEmail
      // matches OR the resolved contactId matches a payload.contactId. Both
      // gates further require signalType match.
      //
      // Case-insensitivity: Prisma's JSON filters do NOT support
      // `mode: "insensitive"` (that's a String-field-only modifier). We rely
      // on the writers always lowercasing recipientEmail before persisting:
      //   - emails.ts:pickFirstExternalRecipient → trim().toLowerCase()
      //   - scripts/backfill-buyer-rep-actions.mjs → same
      //   - this function (below) — caller's recipientEmail is also passed
      //     through unchanged but is matched against the stored lowercase
      //     value via lowerEmail.
      // So an `equals: lowerEmail` against the stored JSON path is correct
      // case-insensitivity for our data.
      const orClauses: Record<string, unknown>[] = []
      if (lowerEmail) {
        orClauses.push({
          payload: {
            path: ["recipientEmail"],
            equals: lowerEmail,
          },
        })
      }
      if (effectiveContactId) {
        orClauses.push({
          payload: {
            path: ["contactId"],
            equals: effectiveContactId,
          },
        })
      }
      const existingPending = (await tx.agentAction.findFirst({
        where: {
          actionType: "create-deal",
          status: "pending",
          createdAt: { gt: cutoff },
          payload: {
            path: ["signalType"],
            equals: input.signalType,
          },
          OR: orClauses,
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      })) as { id: string } | null

      if (existingPending) {
        return {
          created: false,
          actionId: existingPending.id,
          skipReason: "duplicate-pending-action" as const,
        }
      }
    }

    // 4. Tier resolution. LOI proposals get promoted to tier=auto IF the
    //    source Communication carries an attachment whose filename matches
    //    LOI_FILENAME_RE. Auto here is a UI hint — the action still appears
    //    in the approval queue (status pending), but pre-flagged as
    //    high-confidence. Per Matt's preference, no auto-execute for
    //    buyer-rep; he confirms each big move.
    let tier: ProposeBuyerRepTier = "approve"
    if (input.signalType === "loi") {
      const comm = (await tx.communication.findUnique({
        where: { id: input.communicationId },
        select: { metadata: true },
      })) as { metadata: unknown } | null
      if (comm && hasLoiAttachment(comm.metadata)) {
        tier = "auto"
      }
    }

    // 5. No dedupe hit — create the AgentAction.
    const reason = `Buyer-rep ${input.signalType} signal detected with confidence ${input.confidence}`
    const action = await tx.agentAction.create({
      data: {
        actionType: "create-deal",
        status: "pending",
        tier,
        summary: `Propose buyer-rep deal at ${input.proposedStage} from ${input.signalType} signal`,
        sourceCommunicationId: input.communicationId,
        payload: {
          contactId: effectiveContactId ?? input.contactId ?? null,
          recipientEmail: input.recipientEmail ?? null,
          recipientDisplayName: input.recipientDisplayName ?? null,
          dealType: "buyer_rep",
          dealSource: "buyer_rep_inferred",
          stage: input.proposedStage,
          signalType: input.signalType,
          confidence: input.confidence,
          reason,
        },
      },
    })
    return { created: true, actionId: action.id, tier }
  })
}
