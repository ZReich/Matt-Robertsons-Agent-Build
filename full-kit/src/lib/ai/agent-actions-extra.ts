import type { AgentAction, Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import { AgentActionReviewError, type AgentActionReviewResult } from "./agent-actions"
import { AI_FEEDBACK_SOURCE_TYPES } from "./feedback-source-types"

/**
 * Handlers for approval-todo style AgentActions surfaced through the
 * inline-approve buttons on Todo cards. These complete the switch in
 * `approveAgentAction` so the buttons actually take effect:
 *
 *   - auto-reply        → wires into the existing PendingReply pipeline.
 *                         Approval here marks the AgentAction executed but
 *                         does NOT directly call Microsoft Graph send-mail
 *                         — per Matt's standing rule the actual send remains
 *                         operator-driven through /api/pending-replies/[id].
 *                         If the payload links to a PendingReply we record
 *                         the linkage in metadata so the timeline stitches
 *                         the two artifacts together for audit.
 *   - update-meeting    → applies the proposed Meeting field updates.
 *   - delete-contact    → soft-deletes the Contact (sets archivedAt) and
 *                         cascades the soft-delete to its open Todos so
 *                         they fall off the active list immediately.
 *   - delete-property   → soft-deletes the Property.
 *   - delete-deal       → soft-deletes the Deal.
 *
 * Each handler runs inside a transaction, re-validates the target entity
 * exists and isn't already archived, writes a structured `metadata` blob
 * onto the AgentAction for the audit trail, and creates the matching
 * AiFeedback row so the model gets the approval signal.
 */

interface AutoReplyPayload {
  pendingReplyId?: string
  draftSubject?: string
  draftBody?: string
  recipientEmail?: string
  replyToMessageId?: string
}

interface UpdateMeetingPayload {
  meetingId: string
  date?: string
  endDate?: string
  durationMinutes?: number
  location?: string
  title?: string
  notes?: string
  attendees?: Array<{ contactId: string; role?: string }>
}

interface DeleteContactPayload {
  contactId: string
}

interface DeletePropertyPayload {
  propertyId: string
}

interface DeleteDealPayload {
  dealId: string
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function pickString(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key]
  return typeof v === "string" && v.trim().length > 0 ? v : undefined
}

function pickNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key]
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function parseAutoReplyPayload(action: AgentAction): AutoReplyPayload {
  const p = asRecord(action.payload)
  return {
    pendingReplyId: pickString(p, "pendingReplyId"),
    draftSubject: pickString(p, "draftSubject") ?? pickString(p, "subject"),
    draftBody: pickString(p, "draftBody") ?? pickString(p, "body"),
    recipientEmail: pickString(p, "recipientEmail"),
    replyToMessageId: pickString(p, "replyToMessageId"),
  }
}

function parseUpdateMeetingPayload(action: AgentAction): UpdateMeetingPayload {
  const p = asRecord(action.payload)
  const meetingId = pickString(p, "meetingId")
  if (!meetingId) {
    throw new AgentActionReviewError(
      "meetingId is required",
      400,
      "invalid_payload"
    )
  }
  const attendees = Array.isArray(p.attendees)
    ? p.attendees.flatMap((a) => {
        if (!a || typeof a !== "object" || Array.isArray(a)) return []
        const rec = a as Record<string, unknown>
        const cid = typeof rec.contactId === "string" ? rec.contactId : null
        if (!cid) return []
        const role = typeof rec.role === "string" ? rec.role : undefined
        return [{ contactId: cid, role }]
      })
    : undefined
  return {
    meetingId,
    date: pickString(p, "date"),
    endDate: pickString(p, "endDate"),
    durationMinutes: pickNumber(p, "durationMinutes"),
    location: pickString(p, "location"),
    title: pickString(p, "title"),
    notes: pickString(p, "notes"),
    attendees,
  }
}

function parseDeleteContactPayload(action: AgentAction): DeleteContactPayload {
  const p = asRecord(action.payload)
  const contactId =
    pickString(p, "contactId") ??
    (action.targetEntity?.startsWith("contact:")
      ? action.targetEntity.slice("contact:".length)
      : undefined)
  if (!contactId) {
    throw new AgentActionReviewError(
      "contactId is required",
      400,
      "invalid_payload"
    )
  }
  return { contactId }
}

function parseDeletePropertyPayload(
  action: AgentAction
): DeletePropertyPayload {
  const p = asRecord(action.payload)
  const propertyId =
    pickString(p, "propertyId") ??
    (action.targetEntity?.startsWith("property:")
      ? action.targetEntity.slice("property:".length)
      : undefined)
  if (!propertyId) {
    throw new AgentActionReviewError(
      "propertyId is required",
      400,
      "invalid_payload"
    )
  }
  return { propertyId }
}

function parseDeleteDealPayload(action: AgentAction): DeleteDealPayload {
  const p = asRecord(action.payload)
  const dealId =
    pickString(p, "dealId") ??
    (action.targetEntity?.startsWith("deal:")
      ? action.targetEntity.slice("deal:".length)
      : undefined)
  if (!dealId) {
    throw new AgentActionReviewError(
      "dealId is required",
      400,
      "invalid_payload"
    )
  }
  return { dealId }
}

async function lockAgentActionRow(
  tx: Prisma.TransactionClient,
  actionId: string
): Promise<{ kind: "locked" } | { kind: "executed" }> {
  const rows = await tx.$queryRaw<Array<{ status: string }>>`
    SELECT "status"::text
    FROM "agent_actions"
    WHERE "id" = ${actionId}
    FOR UPDATE
  `
  const row = rows[0]
  if (!row) {
    throw new AgentActionReviewError("action not found", 404, "not_found")
  }
  if (row.status === "executed") return { kind: "executed" }
  if (row.status !== "pending") {
    throw new AgentActionReviewError(
      `cannot approve ${row.status} action`,
      409,
      "invalid_action_status"
    )
  }
  return { kind: "locked" }
}

async function recordFeedback(
  tx: Prisma.TransactionClient,
  action: AgentAction,
  reviewer: string,
  reason: string,
  correctedAction: string
) {
  await tx.aiFeedback.create({
    data: {
      sourceType: AI_FEEDBACK_SOURCE_TYPES.agentAction,
      sourceId: action.id,
      promptVersion: action.promptVersion,
      predictedAction: action.actionType,
      correctedAction,
      reason,
      createdBy: reviewer,
    },
  })
}

export async function autoReplyFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  // Per Matt's standing rule (see /api/pending-replies/[id] route) the
  // actual Graph send-mail is deliberately NOT triggered from agent-action
  // approval. Approving an "auto-reply" AgentAction marks the audit trail,
  // and — when the payload links a PendingReply — flips that PendingReply
  // into the "approved" lane so the existing operator UX picks it up.
  const payload = parseAutoReplyPayload(action)

  await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") return

    const metadata: Record<string, unknown> = {
      handled: "auto-reply",
      pendingReplyId: payload.pendingReplyId ?? null,
      reviewer,
      // The actual Graph send is deliberately deferred — see
      // src/app/api/pending-replies/[id]/route.ts for the gated send path.
      sendImmediate: false,
    }

    if (payload.pendingReplyId) {
      const reply = await tx.pendingReply.findUnique({
        where: { id: payload.pendingReplyId },
        select: { id: true, status: true },
      })
      if (!reply) {
        metadata.pendingReplyMissing = true
      } else if (reply.status === "pending") {
        // Mark the draft approved so it falls out of the pending-replies
        // queue. We do NOT send via Graph here — operator must still hit
        // the explicit "Send" button on the PendingReply card.
        const outboundComm = await tx.communication.create({
          data: {
            channel: "email",
            direction: "outbound",
            subject: payload.draftSubject ?? "(no subject)",
            body: payload.draftBody ?? "",
            date: new Date(),
            metadata: {
              source: "auto-reply-approved-via-agent-action",
              pendingReplyId: payload.pendingReplyId,
              agentActionId: action.id,
            },
          },
          select: { id: true },
        })
        await tx.pendingReply.update({
          where: { id: payload.pendingReplyId },
          data: {
            status: "approved",
            approvedAt: new Date(),
            approvedBy: reviewer,
            approvedCommunicationId: outboundComm.id,
          },
        })
        metadata.outboundCommunicationId = outboundComm.id
      } else {
        // Already approved/dismissed/sent — just record the existing state.
        metadata.pendingReplyStatus = reply.status
      }
    }

    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: new Date(),
        feedback: reviewer === "auto" ? "auto-approved" : null,
        payload: {
          ...asRecord(action.payload),
          _approval: metadata,
        } as Prisma.InputJsonValue,
      },
    })

    await recordFeedback(
      tx,
      action,
      reviewer,
      "auto-reply approved",
      "auto-reply"
    )
  })

  return { status: "executed", actionId: action.id }
}

export async function updateMeetingFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = parseUpdateMeetingPayload(action)

  await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") return

    const meeting = await tx.meeting.findUnique({
      where: { id: payload.meetingId },
      select: { id: true, archivedAt: true },
    })
    if (!meeting) {
      throw new AgentActionReviewError(
        `meeting ${payload.meetingId} not found`,
        404,
        "meeting_missing"
      )
    }
    if (meeting.archivedAt !== null) {
      throw new AgentActionReviewError(
        `meeting ${payload.meetingId} is archived`,
        409,
        "meeting_archived"
      )
    }

    const data: Prisma.MeetingUpdateInput = {}
    const applied: Record<string, unknown> = {}
    if (payload.date) {
      const d = new Date(payload.date)
      if (Number.isNaN(d.getTime())) {
        throw new AgentActionReviewError(
          "invalid date in payload",
          400,
          "invalid_payload"
        )
      }
      data.date = d
      applied.date = d.toISOString()
    }
    if (payload.endDate) {
      const d = new Date(payload.endDate)
      if (Number.isNaN(d.getTime())) {
        throw new AgentActionReviewError(
          "invalid endDate in payload",
          400,
          "invalid_payload"
        )
      }
      data.endDate = d
      applied.endDate = d.toISOString()
    }
    if (payload.durationMinutes !== undefined) {
      data.durationMinutes = payload.durationMinutes
      applied.durationMinutes = payload.durationMinutes
    }
    if (payload.location !== undefined) {
      data.location = payload.location
      applied.location = payload.location
    }
    if (payload.title !== undefined) {
      data.title = payload.title
      applied.title = payload.title
    }
    if (payload.notes !== undefined) {
      data.notes = payload.notes
      applied.notes = payload.notes
    }

    if (Object.keys(data).length === 0 && !payload.attendees) {
      throw new AgentActionReviewError(
        "no fields to update",
        400,
        "invalid_payload"
      )
    }

    if (Object.keys(data).length > 0) {
      await tx.meeting.update({ where: { id: payload.meetingId }, data })
    }

    if (payload.attendees) {
      await tx.meetingAttendee.deleteMany({
        where: { meetingId: payload.meetingId },
      })
      if (payload.attendees.length > 0) {
        await tx.meetingAttendee.createMany({
          data: payload.attendees.map((a) => ({
            meetingId: payload.meetingId,
            contactId: a.contactId,
            role: a.role ?? null,
          })),
          skipDuplicates: true,
        })
      }
      applied.attendees = payload.attendees.map((a) => a.contactId)
    }

    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: new Date(),
        feedback: reviewer === "auto" ? "auto-approved" : null,
        payload: {
          ...asRecord(action.payload),
          _approval: { handled: "update-meeting", applied, reviewer },
        } as Prisma.InputJsonValue,
      },
    })

    await recordFeedback(
      tx,
      action,
      reviewer,
      "meeting updated",
      "update-meeting"
    )
  })

  return { status: "executed", actionId: action.id }
}

export async function deleteContactFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = parseDeleteContactPayload(action)
  const now = new Date()

  await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") return

    const contact = await tx.contact.findUnique({
      where: { id: payload.contactId },
      select: { id: true, archivedAt: true },
    })
    if (!contact) {
      throw new AgentActionReviewError(
        `contact ${payload.contactId} not found`,
        404,
        "contact_missing"
      )
    }
    if (contact.archivedAt !== null) {
      // Idempotent: already archived means the operator can ignore the
      // queue row but we still treat the approval as the success state.
      await tx.agentAction.update({
        where: { id: action.id },
        data: {
          status: "executed",
          executedAt: now,
          feedback: reviewer === "auto" ? "auto-approved" : null,
          payload: {
            ...asRecord(action.payload),
            _approval: {
              handled: "delete-contact",
              alreadyArchived: true,
              reviewer,
            },
          } as Prisma.InputJsonValue,
        },
      })
      return
    }

    await tx.contact.update({
      where: { id: payload.contactId },
      data: { archivedAt: now },
    })
    // Cascade: any open todos referencing this contact should fall off the
    // active list. We don't touch closed/done todos so the audit trail of
    // historic work survives.
    const cascaded = await tx.todo.updateMany({
      where: {
        contactId: payload.contactId,
        archivedAt: null,
        status: { in: ["pending", "in_progress"] },
      },
      data: { archivedAt: now },
    })

    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: now,
        feedback: reviewer === "auto" ? "auto-approved" : null,
        payload: {
          ...asRecord(action.payload),
          _approval: {
            handled: "delete-contact",
            archivedTodoCount: cascaded.count,
            reviewer,
          },
        } as Prisma.InputJsonValue,
      },
    })

    await recordFeedback(
      tx,
      action,
      reviewer,
      "contact soft-deleted",
      "delete-contact"
    )
  })

  return { status: "executed", actionId: action.id }
}

export async function deletePropertyFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = parseDeletePropertyPayload(action)
  const now = new Date()

  await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") return

    const property = await tx.property.findUnique({
      where: { id: payload.propertyId },
      select: { id: true, archivedAt: true },
    })
    if (!property) {
      throw new AgentActionReviewError(
        `property ${payload.propertyId} not found`,
        404,
        "property_missing"
      )
    }

    if (property.archivedAt === null) {
      await tx.property.update({
        where: { id: payload.propertyId },
        data: { archivedAt: now },
      })
    }

    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: now,
        feedback: reviewer === "auto" ? "auto-approved" : null,
        payload: {
          ...asRecord(action.payload),
          _approval: {
            handled: "delete-property",
            alreadyArchived: property.archivedAt !== null,
            reviewer,
          },
        } as Prisma.InputJsonValue,
      },
    })

    await recordFeedback(
      tx,
      action,
      reviewer,
      "property soft-deleted",
      "delete-property"
    )
  })

  return { status: "executed", actionId: action.id }
}

export async function deleteDealFromAction(
  action: AgentAction,
  reviewer: string
): Promise<AgentActionReviewResult> {
  const payload = parseDeleteDealPayload(action)
  const now = new Date()

  await db.$transaction(async (tx) => {
    const lock = await lockAgentActionRow(tx, action.id)
    if (lock.kind === "executed") return

    const deal = await tx.deal.findUnique({
      where: { id: payload.dealId },
      select: { id: true, archivedAt: true },
    })
    if (!deal) {
      throw new AgentActionReviewError(
        `deal ${payload.dealId} not found`,
        404,
        "deal_missing"
      )
    }

    if (deal.archivedAt === null) {
      await tx.deal.update({
        where: { id: payload.dealId },
        data: { archivedAt: now },
      })
    }

    await tx.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        executedAt: now,
        feedback: reviewer === "auto" ? "auto-approved" : null,
        payload: {
          ...asRecord(action.payload),
          _approval: {
            handled: "delete-deal",
            alreadyArchived: deal.archivedAt !== null,
            reviewer,
          },
        } as Prisma.InputJsonValue,
      },
    })

    await recordFeedback(tx, action, reviewer, "deal soft-deleted", "delete-deal")
  })

  return { status: "executed", actionId: action.id }
}
