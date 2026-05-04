// Phase E live-DB verification test.
//
// Skipped unless PHASE_E_LIVE=1 is set. Runs end-to-end against the real
// Supabase database — creates a synthetic Communication + ContactPromotionCandidate,
// approves it via reviewContactPromotionCandidate, and asserts the
// Phase E hook wired up a PendingReply for the matched Property.
//
// Run with:
//   set -a && source .env.local && set +a
//   PHASE_E_LIVE=1 pnpm test contact-promotion-auto-reply.live
//
// This test calls DeepSeek (real) so it will incur a tiny token cost. It
// does NOT toggle autoSendNewLeadReplies, so no email is ever sent.

import { afterAll, describe, expect, it, vi } from "vitest"

import { reviewContactPromotionCandidate } from "@/lib/contact-promotion-candidates"
import { db } from "@/lib/prisma"

vi.mock("server-only", () => ({}))

const SHOULD_RUN = process.env.PHASE_E_LIVE === "1"

const SUFFIX = `${Date.now()}`

describe.runIf(SHOULD_RUN)("Phase E live-DB hook", () => {
  let createdCommId: string | null = null
  let createdCandidateId: string | null = null
  let createdContactId: string | null = null
  let createdPendingReplyId: string | null = null

  afterAll(async () => {
    // Cleanup in dependency order.
    if (createdPendingReplyId) {
      await db.pendingReply
        .delete({ where: { id: createdPendingReplyId } })
        .catch(() => undefined)
    }
    if (createdCandidateId) {
      await db.contactPromotionCandidate
        .delete({ where: { id: createdCandidateId } })
        .catch(() => undefined)
    }
    if (createdCommId) {
      await db.communication
        .update({
          where: { id: createdCommId },
          data: { contactId: null },
        })
        .catch(() => undefined)
    }
    if (createdContactId) {
      await db.contact
        .delete({ where: { id: createdContactId } })
        .catch(() => undefined)
    }
    if (createdCommId) {
      await db.communication
        .delete({ where: { id: createdCommId } })
        .catch(() => undefined)
    }
    await db.$disconnect()
  })

  it("creates a PendingReply when an approved candidate's email matches a catalog Property", async () => {
    const property = await db.property.findFirst({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, propertyKey: true, address: true, name: true },
    })
    expect(property).not.toBeNull()
    if (!property) return

    const inquirerEmail = `phase-e-verify-${SUFFIX}@example.test`
    const inquirerName = `Phase E Verify ${SUFFIX}`

    const comm = await db.communication.create({
      data: {
        channel: "email",
        subject: `LoopNet Lead for ${property.name ?? property.address}`,
        body: `Hello, I'm interested in this listing.\n${property.address}\nPlease send the OM. Thanks!`,
        direction: "inbound",
        date: new Date(),
        metadata: {
          source: "platform-lead-loopnet",
          extracted: {
            platform: "loopnet",
            kind: "inquiry",
            propertyKey: property.propertyKey,
          },
          phaseEVerify: SUFFIX,
        },
      },
      select: { id: true },
    })
    createdCommId = comm.id

    const candidate = await db.contactPromotionCandidate.create({
      data: {
        normalizedEmail: inquirerEmail,
        displayName: inquirerName,
        message: "Inquiry from Phase E verification test.",
        source: "phase-e-verify",
        sourcePlatform: "loopnet",
        sourceKind: "inquiry",
        status: "pending",
        evidenceCount: 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        communicationId: comm.id,
        dedupeKey: `phase-e-verify:${SUFFIX}`,
        metadata: {
          leadSource: "loopnet",
          communicationIds: [comm.id],
          phaseEVerify: SUFFIX,
        },
      },
      select: { id: true },
    })
    createdCandidateId = candidate.id

    const result = await reviewContactPromotionCandidate({
      id: candidate.id,
      action: "approve_create_contact",
      reviewer: "phase-e-live-test",
    })
    expect(result.contact).not.toBeNull()
    if (result.contact) createdContactId = result.contact.id

    // The hook is awaited inside reviewContactPromotionCandidate, so by the
    // time we get here the PendingReply (if any) is committed.
    const pr = await db.pendingReply.findFirst({
      where: {
        triggerCommunicationId: comm.id,
        propertyId: property.id,
      },
      select: {
        id: true,
        status: true,
        draftSubject: true,
        modelUsed: true,
        contactId: true,
      },
    })
    expect(pr).not.toBeNull()
    if (pr) {
      createdPendingReplyId = pr.id
      expect(pr.contactId).toBe(result.contact?.id)
      expect(pr.status).toBe("pending")
      expect(pr.draftSubject.length).toBeGreaterThan(0)
    }
  }, 60_000)
})
