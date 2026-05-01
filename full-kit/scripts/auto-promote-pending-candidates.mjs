// Drains the contact-candidates queue using the policy decision already
// stored on each candidate's metadata.autoPromotion. This replicates the same
// transactions the manual review buttons do (approve_create_contact /
// approve_link_contact / not_a_contact).
//
//   node scripts/auto-promote-pending-candidates.mjs           # dry run
//   node scripts/auto-promote-pending-candidates.mjs --apply   # actually run

import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
const AUTO_CREATE_THRESHOLD = 80
const REVIEWER = "auto-promote-script"
const PLATFORM_LEAD_SOURCES = new Set([
  "crexi",
  "loopnet",
  "buildout",
  "email_cold",
  "referral",
])

const prisma = new PrismaClient()

function classify(candidate) {
  const auto = candidate.metadata?.autoPromotion
  if (!auto?.decision) return { kind: "skip", reason: "no_policy_decision" }

  if (auto.decision === "blocked") {
    return {
      kind: "not_a_contact",
      reason: `blocked:${(auto.blockedReasons ?? []).join(",") || "unspecified"}`,
    }
  }
  if (
    auto.decision === "auto_create_contact" &&
    typeof auto.score === "number" &&
    auto.score >= AUTO_CREATE_THRESHOLD
  ) {
    return {
      kind: "approve_create",
      reason: `auto_create_contact:${(auto.reasonCodes ?? []).join(",") || "score>=80"}`,
    }
  }
  if (auto.decision === "auto_link_existing" && auto.matchedContactId) {
    return {
      kind: "approve_link",
      contactId: auto.matchedContactId,
      reason: "auto_link_existing",
    }
  }
  return {
    kind: "skip",
    reason: `decision:${auto.decision}/score:${auto.score ?? "?"}`,
  }
}

function evidenceIds(candidate) {
  const ids = new Set()
  if (candidate.communicationId) ids.add(candidate.communicationId)
  for (const id of candidate.metadata?.communicationIds ?? []) {
    if (typeof id === "string") ids.add(id)
  }
  return [...ids]
}

function leadSourceFromCandidate(candidate) {
  const md = candidate.metadata ?? {}
  const value = typeof md.leadSource === "string" ? md.leadSource : candidate.sourcePlatform
  return value && PLATFORM_LEAD_SOURCES.has(value) ? value : null
}

function buildPromotionNotes(candidate) {
  const lines = [
    "Created from a reviewed contact promotion candidate.",
    `Candidate ID: ${candidate.id}`,
    `Source: ${candidate.sourcePlatform ?? candidate.source} / ${candidate.sourceKind ?? "unknown"}`,
    `Evidence count: ${candidate.evidenceCount}`,
    `First seen: ${candidate.firstSeenAt.toISOString()}`,
    `Last seen: ${candidate.lastSeenAt.toISOString()}`,
  ]
  if (candidate.message) lines.push("", candidate.message)
  return lines.join("\n")
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

function buildReviewMetadata(candidate, status, contactId, reason, contactCreated) {
  const now = new Date().toISOString()
  const promotionReview = {
    action:
      status === "approved"
        ? "approve_create_contact"
        : status === "merged"
          ? "approve_link_contact"
          : status,
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

async function applyApproveCreate(candidate, reason) {
  return prisma.$transaction(async (tx) => {
    if (candidate.normalizedEmail) {
      const dupes = await tx.contact.findMany({
        where: {
          email: { equals: candidate.normalizedEmail, mode: "insensitive" },
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
            metadata: buildReviewMetadata(candidate, "merged", dupes[0].id, reason, false),
          },
        })
        return { kind: "approve_link", contactId: dupes[0].id }
      }
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
        leadSource: leadSourceFromCandidate(candidate),
        leadStatus: "new",
        leadAt: candidate.firstSeenAt,
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
        metadata: buildReviewMetadata(candidate, "approved", contact.id, reason, true),
      },
    })
    return { kind: "approve_create", contactId: contact.id }
  }, { maxWait: 10_000, timeout: 60_000 })
}

async function applyApproveLink(candidate, contactId, reason) {
  return prisma.$transaction(async (tx) => {
    const contact = await tx.contact.findUnique({ where: { id: contactId }, select: { id: true } })
    if (!contact) throw new Error("matched contact not found")
    await linkEvidence(tx, candidate, contactId)
    await tx.contactPromotionCandidate.update({
      where: { id: candidate.id },
      data: {
        status: "merged",
        approvedContactId: contactId,
        metadata: buildReviewMetadata(candidate, "merged", contactId, reason, false),
      },
    })
    return { kind: "approve_link", contactId }
  }, { maxWait: 10_000, timeout: 60_000 })
}

async function applyNotAContact(candidate, reason) {
  return prisma.contactPromotionCandidate.update({
    where: { id: candidate.id },
    data: {
      status: "not_a_contact",
      metadata: buildReviewMetadata(candidate, "not_a_contact", null, reason, false),
    },
  })
}

async function main() {
  const candidates = await prisma.contactPromotionCandidate.findMany({
    where: { status: { in: ["pending", "needs_more_evidence"] } },
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
    orderBy: { createdAt: "asc" },
  })

  const tally = {
    total: candidates.length,
    approve_create: 0,
    approve_link: 0,
    not_a_contact: 0,
    skip: 0,
    errors: 0,
  }
  const errors = []

  for (const candidate of candidates) {
    const action = classify(candidate)
    if (action.kind === "skip") {
      tally.skip++
      continue
    }

    if (!APPLY) {
      tally[action.kind]++
      continue
    }

    try {
      if (action.kind === "approve_create") {
        const r = await applyApproveCreate(candidate, action.reason)
        tally[r.kind === "approve_link" ? "approve_link" : "approve_create"]++
      } else if (action.kind === "approve_link") {
        await applyApproveLink(candidate, action.contactId, action.reason)
        tally.approve_link++
      } else if (action.kind === "not_a_contact") {
        await applyNotAContact(candidate, action.reason)
        tally.not_a_contact++
      }
    } catch (e) {
      tally.errors++
      errors.push({
        id: candidate.id,
        email: candidate.normalizedEmail,
        action: action.kind,
        error: e?.message ?? String(e),
      })
    }
  }

  console.log("")
  console.log(APPLY ? "Applied:" : "Dry run (no changes):")
  console.log(JSON.stringify(tally, null, 2))
  if (errors.length > 0) {
    console.log("")
    console.log("Errors:")
    console.log(JSON.stringify(errors, null, 2))
  }
  if (!APPLY) {
    console.log("")
    console.log("Re-run with --apply to actually take these actions.")
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
