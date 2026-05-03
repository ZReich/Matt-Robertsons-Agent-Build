import "server-only"

import { generatePendingReply } from "@/lib/ai/auto-reply"
import { sendMailAsMatt } from "@/lib/msgraph/send-mail"
import { db } from "@/lib/prisma"
import { getAutomationSettings } from "@/lib/system-state/automation-settings"

/**
 * Daily renewal-alert sweep.
 *
 * Pipeline:
 *   1. Find every active LeaseRecord whose `leaseEndDate` is between
 *      `now + lookaheadMonths - 7d` and `now + lookaheadMonths`. The 7-day
 *      sliding window is the idempotency key — once a lease is processed
 *      its status flips to `expiring_soon`, so it won't be picked up again
 *      on subsequent days as the calendar rolls forward.
 *   2. For each match (in a single transaction):
 *        - Create a Todo (medium priority, due in 5 days)
 *        - Create a CalendarEvent (kind = "lease_renewal_outreach")
 *        - Flip LeaseRecord.status to "expiring_soon"
 *      Outside the transaction (because it makes an external AI call):
 *        - Generate a PendingReply via generatePendingReply with
 *          `outreachKind: "lease_renewal"`.
 *        - If automation.autoSendLeaseRenewalReplies is on, send via Graph.
 *   3. Result summarises hits, side-effects created, drafts skipped.
 */

export interface RenewalAlertSweepOptions {
  /** Override the lookahead window (in months). Default: from automation
   * settings, then 6. Range 1-24. */
  lookaheadMonths?: number
  /** Override "now" — primarily for tests. */
  now?: Date
}

export interface RenewalAlertOutcome {
  leaseRecordId: string
  contactId: string
  todoId: string
  calendarEventId: string
  pendingReplyId: string | null
  draftSent: boolean
  draftSkippedReason: string | null
}

export interface SweepResult {
  ok: true
  scannedAt: string
  lookaheadMonths: number
  windowStart: string
  windowEnd: string
  candidatesFound: number
  outcomes: RenewalAlertOutcome[]
  errors: string[]
}

const SLIDING_WINDOW_DAYS = 7

function clampLookahead(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  if (value < 1) return 1
  if (value > 24) return 24
  return Math.round(value)
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  out.setUTCMonth(out.getUTCMonth() + months)
  return out
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function dueDateFromNow(now: Date): Date {
  return addDays(now, 5)
}

export async function runRenewalAlertSweep(
  opts: RenewalAlertSweepOptions = {}
): Promise<SweepResult> {
  const settings = await getAutomationSettings()
  const lookaheadMonths = clampLookahead(
    opts.lookaheadMonths,
    settings.leaseRenewalLookaheadMonths
  )
  const now = opts.now ?? new Date()

  // Sliding 7-day window ending at `now + lookaheadMonths`.
  const windowEnd = addMonths(now, lookaheadMonths)
  const windowStart = addDays(windowEnd, -SLIDING_WINDOW_DAYS)

  const candidates = await db.leaseRecord.findMany({
    where: {
      status: "active",
      archivedAt: null,
      leaseEndDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      contact: { select: { id: true, name: true, email: true } },
      property: { select: { id: true, address: true } },
    },
    orderBy: { leaseEndDate: "asc" },
  })

  const result: SweepResult = {
    ok: true,
    scannedAt: now.toISOString(),
    lookaheadMonths,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    candidatesFound: candidates.length,
    outcomes: [],
    errors: [],
  }

  if (candidates.length === 0) return result

  const dueDate = dueDateFromNow(now)

  for (const lease of candidates) {
    const contactName =
      lease.contact?.name ?? lease.contact?.email ?? "this client"
    const propertyAddress = lease.property?.address ?? "(no address)"
    const leaseEndIso = lease.leaseEndDate
      ? new Date(lease.leaseEndDate).toISOString().slice(0, 10)
      : "(no end date)"
    const title = `Reach out to ${contactName} — lease at ${propertyAddress} expires ${leaseEndIso}`

    let todoId: string
    let calendarEventId: string
    try {
      const transactional = await db.$transaction(async (tx) => {
        // Re-read inside the txn so concurrent sweeps don't double-fire.
        const fresh = await tx.leaseRecord.findUnique({
          where: { id: lease.id },
          select: { status: true },
        })
        if (!fresh || fresh.status !== "active") {
          return null
        }

        const todo = await tx.todo.create({
          data: {
            title,
            priority: "medium",
            dueDate,
            contactId: lease.contactId,
            dealId: lease.dealId ?? null,
            createdBy: "lease-renewal-sweep",
            dedupeKey: `lease-renewal:${lease.id}`,
          },
          select: { id: true },
        })

        const event = await tx.calendarEvent.create({
          data: {
            title,
            startDate: now,
            allDay: true,
            eventKind: "lease_renewal_outreach",
            contactId: lease.contactId,
            dealId: lease.dealId ?? null,
            propertyId: lease.propertyId ?? null,
            leaseRecordId: lease.id,
            source: "system",
            status: "upcoming",
            createdBy: "lease-renewal-sweep",
          },
          select: { id: true },
        })

        await tx.leaseRecord.update({
          where: { id: lease.id },
          data: { status: "expiring_soon" },
        })

        return { todoId: todo.id, calendarEventId: event.id }
      })

      if (!transactional) {
        // Lease was already flipped by a concurrent run — skip.
        continue
      }
      todoId = transactional.todoId
      calendarEventId = transactional.calendarEventId
    } catch (e) {
      result.errors.push(
        `lease ${lease.id}: txn failed — ${e instanceof Error ? e.message : "unknown"}`
      )
      continue
    }

    // PendingReply generation runs OUTSIDE the txn (external API call).
    let pendingReplyId: string | null = null
    let draftSkippedReason: string | null = null
    let draftSent = false

    try {
      const draft = await generatePendingReply({
        contactId: lease.contactId,
        leaseRecordId: lease.id,
        triggerCommunicationId: lease.sourceCommunicationId ?? undefined,
        outreachKind: "lease_renewal",
        persist: true,
      })
      if (draft.ok) {
        pendingReplyId = draft.pendingReplyId
        if (
          settings.autoSendLeaseRenewalReplies &&
          pendingReplyId &&
          lease.contact?.email
        ) {
          const sendResult = await sendMailAsMatt({
            subject: draft.draft.subject,
            body: draft.draft.body,
            contentType: "Text",
            toRecipients: [
              { address: lease.contact.email, name: lease.contact.name },
            ],
            saveToSentItems: true,
          })
          if (sendResult.ok) {
            await db.pendingReply.update({
              where: { id: pendingReplyId },
              data: {
                status: "approved",
                approvedAt: new Date(),
                approvedBy: "auto-send-lease-renewal",
              },
            })
            draftSent = true
          } else {
            result.errors.push(
              `send ${lease.contact.email}: ${sendResult.reason}${sendResult.details ? " — " + sendResult.details : ""}`
            )
          }
        }
      } else {
        draftSkippedReason = draft.reason
        result.errors.push(
          `draft lease ${lease.id}: ${draft.reason}${draft.details ? " — " + draft.details : ""}`
        )
      }
    } catch (e) {
      draftSkippedReason = "exception"
      result.errors.push(
        `draft lease ${lease.id}: exception — ${e instanceof Error ? e.message : "unknown"}`
      )
    }

    result.outcomes.push({
      leaseRecordId: lease.id,
      contactId: lease.contactId,
      todoId,
      calendarEventId,
      pendingReplyId,
      draftSent,
      draftSkippedReason,
    })
  }

  return result
}
