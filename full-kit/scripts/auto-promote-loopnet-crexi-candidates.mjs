// One-off: drain the LoopNet/Crexi inquiry candidates that were queued for
// human review. The "inquiry" signal-kind on these platforms means the
// inquirer sent us an email about a specific listing — strong enough that
// we can promote them to a lead Contact without the safety check the
// review queue exists for.
//
// "favorited" candidates (LoopNet only — a button-click with no message)
// are intentionally NOT auto-promoted by this script; they stay in the
// review queue.
//
//   node scripts/auto-promote-loopnet-crexi-candidates.mjs           # dry run
//   node scripts/auto-promote-loopnet-crexi-candidates.mjs --apply   # actually run

import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
const REVIEWER = "auto-promote-loopnet-crexi-script"

const prisma = new PrismaClient()

const PLATFORM_TO_LEAD_SOURCE = {
  loopnet: "loopnet",
  crexi: "crexi",
}

function evidenceIds(candidate) {
  const ids = new Set()
  if (candidate.communicationId) ids.add(candidate.communicationId)
  for (const id of candidate.metadata?.communicationIds ?? []) {
    if (typeof id === "string") ids.add(id)
  }
  return [...ids]
}

function buildPromotionNotes(candidate) {
  return [
    "Created from a reviewed contact promotion candidate (loopnet/crexi auto-promote).",
    `Candidate ID: ${candidate.id}`,
    `Source: ${candidate.sourcePlatform} / ${candidate.sourceKind}`,
    `Evidence count: ${candidate.evidenceCount}`,
    `First seen: ${candidate.firstSeenAt.toISOString()}`,
    `Last seen: ${candidate.lastSeenAt.toISOString()}`,
    candidate.message ? "" : null,
    candidate.message ? candidate.message : null,
  ]
    .filter((line) => line !== null)
    .join("\n")
}

function evidenceSnapshot(candidate) {
  return {
    candidateId: candidate.id,
    dedupeKey: candidate.dedupeKey,
    normalizedEmail: candidate.normalizedEmail,
    displayName: candidate.displayName,
    company: candidate.company,
    phone: candidate.phone,
    message: candidate.message,
    source: candidate.source,
    sourcePlatform: candidate.sourcePlatform,
    sourceKind: candidate.sourceKind,
    communicationId: candidate.communicationId,
    evidenceCount: candidate.evidenceCount,
    firstSeenAt: candidate.firstSeenAt.toISOString(),
    lastSeenAt: candidate.lastSeenAt.toISOString(),
    metadata: candidate.metadata,
  }
}

function buildReviewMetadata(candidate, status, contactId, reason, contactCreated) {
  const now = new Date().toISOString()
  const promotionReview = {
    action:
      status === "approved" ? "approve_create_contact" : "approve_link_contact",
    decidedAt: now,
    reviewer: REVIEWER,
    reason,
    status,
    approvedContactId: contactId ?? null,
    contactCreated,
    snoozedUntil: null,
    evidenceSnapshot: evidenceSnapshot(candidate),
  }
  const existingHistory = Array.isArray(candidate.metadata?.promotionReviewHistory)
    ? candidate.metadata.promotionReviewHistory
    : []
  return {
    ...(candidate.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata) ? candidate.metadata : {}),
    promotionReview,
    promotionReviewHistory: [...existingHistory, promotionReview],
  }
}

async function linkEvidence(tx, candidate, contactId) {
  const ids = evidenceIds(candidate)
  if (ids.length === 0) return
  const comms = await tx.communication.findMany({
    where: { id: { in: ids } },
    select: { id: true, contactId: true, metadata: true },
  })
  for (const c of comms) {
    if (c.contactId && c.contactId !== contactId) {
      throw new Error(`communication ${c.id} already linked to ${c.contactId}`)
    }
  }
  for (const c of comms) {
    await tx.communication.update({
      where: { id: c.id },
      data: {
        contactId,
        metadata: {
          ...(c.metadata && typeof c.metadata === "object" && !Array.isArray(c.metadata) ? c.metadata : {}),
          promotionReview: {
            candidateId: candidate.id,
            contactId,
            linkedAt: new Date().toISOString(),
            reviewer: REVIEWER,
          },
        },
      },
    })
  }
}

async function applyApprove(candidate) {
  return prisma.$transaction(
    async (tx) => {
      const email = candidate.normalizedEmail?.toLowerCase()
      if (!email) {
        throw new Error("candidate has no normalized email")
      }

      // If a non-archived Contact with this email already exists, link
      // evidence to it and merge instead of creating a duplicate.
      const dupes = await tx.contact.findMany({
        where: {
          email: { equals: email, mode: "insensitive" },
          archivedAt: null,
        },
        select: { id: true },
        take: 2,
      })
      if (dupes.length > 1) {
        throw new Error("multiple active contacts match candidate email")
      }
      if (dupes.length === 1) {
        await linkEvidence(tx, candidate, dupes[0].id)
        await tx.contactPromotionCandidate.update({
          where: { id: candidate.id },
          data: {
            status: "merged",
            approvedContactId: dupes[0].id,
            metadata: buildReviewMetadata(
              candidate,
              "merged",
              dupes[0].id,
              "single_existing_contact_email_match",
              false
            ),
          },
        })
        return { kind: "merged", contactId: dupes[0].id }
      }

      // No existing contact — create a new lead contact.
      const leadSource = PLATFORM_TO_LEAD_SOURCE[candidate.sourcePlatform]
      // leadAt = actual inquiry date (linked communication.date), not the
      // candidate row's firstSeenAt. firstSeenAt is when the candidate row
      // was inserted by ingest/backfill, which can drift from the actual
      // inquiry by weeks or months.
      let inquiryDate = candidate.firstSeenAt
      if (candidate.communicationId) {
        const comm = await tx.communication.findUnique({
          where: { id: candidate.communicationId },
          select: { date: true },
        })
        if (comm?.date) inquiryDate = comm.date
      }
      const contact = await tx.contact.create({
        data: {
          name:
            candidate.displayName?.trim() ||
            candidate.normalizedEmail?.trim() ||
            "Unknown contact candidate",
          company: candidate.company,
          email: candidate.normalizedEmail,
          phone: candidate.phone,
          notes: buildPromotionNotes(candidate),
          category: "business",
          tags: ["candidate-approved", candidate.sourcePlatform].filter(Boolean),
          createdBy: "candidate-review",
          leadSource,
          leadStatus: "new",
          leadAt: inquiryDate,
          leadLastViewedAt: new Date(),
        },
        select: { id: true },
      })
      await linkEvidence(tx, candidate, contact.id)
      await tx.contactPromotionCandidate.update({
        where: { id: candidate.id },
        data: {
          status: "approved",
          approvedContactId: contact.id,
          metadata: buildReviewMetadata(
            candidate,
            "approved",
            contact.id,
            `auto_promote:${candidate.sourcePlatform}/${candidate.sourceKind}`,
            true
          ),
        },
      })
      return { kind: "created", contactId: contact.id }
    },
    { maxWait: 10_000, timeout: 60_000 }
  )
}

async function main() {
  const candidates = await prisma.contactPromotionCandidate.findMany({
    where: {
      status: { in: ["pending", "needs_more_evidence"] },
      sourcePlatform: { in: ["loopnet", "crexi"] },
      sourceKind: "inquiry",
    },
    select: {
      id: true,
      displayName: true,
      normalizedEmail: true,
      phone: true,
      company: true,
      message: true,
      source: true,
      sourcePlatform: true,
      sourceKind: true,
      dedupeKey: true,
      communicationId: true,
      evidenceCount: true,
      firstSeenAt: true,
      lastSeenAt: true,
      metadata: true,
    },
    orderBy: { lastSeenAt: "desc" },
  })

  const tally = {
    total: candidates.length,
    created: 0,
    merged: 0,
    skipped: 0,
    errors: 0,
  }
  const errors = []

  for (const candidate of candidates) {
    if (!candidate.normalizedEmail) {
      tally.skipped++
      continue
    }
    if (!APPLY) {
      tally.created++ // dry-run accounting; we don't know merged-vs-created without DB write
      continue
    }
    try {
      const result = await applyApprove(candidate)
      tally[result.kind]++
    } catch (e) {
      tally.errors++
      errors.push({
        id: candidate.id,
        email: candidate.normalizedEmail,
        error: e?.message ?? String(e),
      })
    }
  }

  console.log("")
  console.log(APPLY ? "Applied:" : "Dry run (no changes):")
  console.log(JSON.stringify(tally, null, 2))
  if (errors.length > 0) {
    console.log("\nErrors:")
    console.log(JSON.stringify(errors, null, 2))
  }
  if (!APPLY) {
    console.log("\nRe-run with --apply to actually take these actions.")
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
