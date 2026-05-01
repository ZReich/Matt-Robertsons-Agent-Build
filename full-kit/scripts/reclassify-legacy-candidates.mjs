// Re-evaluates legacy contact-candidates that have no metadata.autoPromotion
// (created by historical backfills before the live policy was wired). Uses a
// conservative subset of the live policy:
//   1) blocked automation address           -> not_a_contact
//   2) exactly one active Contact w/ email  -> approve_link
//   3) Matt has at least one outbound reply
//      to that email + total >= 2 comms     -> approve_create
//   4) source ends with "matt-outbound"
//      (Matt initiated)                     -> approve_create
//   5) otherwise                            -> leave for review
//
//   node scripts/reclassify-legacy-candidates.mjs           # dry run
//   node scripts/reclassify-legacy-candidates.mjs --apply   # actually run

import { PrismaClient } from "@prisma/client"

const APPLY = process.argv.includes("--apply")
const REVIEWER = "reclassify-legacy-script"
const PLATFORM_LEAD_SOURCES = new Set([
  "crexi",
  "loopnet",
  "buildout",
  "email_cold",
  "referral",
])

const prisma = new PrismaClient()

function isBlockedAutomationAddress(email) {
  const [local = "", domain = ""] = email.toLowerCase().split("@")
  if (
    /^(no-?reply|do-?not-?reply|notification|notifications|mailer|postmaster)$/i.test(
      local
    )
  ) {
    return true
  }
  return [
    "buildout.com",
    "crexi.com",
    "loopnet.com",
    "costar.com",
    "docusign.net",
    "dotloop.com",
  ].some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))
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

async function classifyAndApply(candidate) {
  const email = candidate.normalizedEmail?.trim().toLowerCase()
  if (!email) return { kind: "skip", reason: "no_email" }

  if (isBlockedAutomationAddress(email)) {
    if (APPLY) {
      await prisma.contactPromotionCandidate.update({
        where: { id: candidate.id },
        data: {
          status: "not_a_contact",
          metadata: buildReviewMetadata(candidate, "not_a_contact", null, "blocked:automation_address", false),
        },
      })
    }
    return { kind: "not_a_contact", reason: "blocked_automation" }
  }

  const dupes = await prisma.contact.findMany({
    where: { email: { equals: email, mode: "insensitive" }, archivedAt: null },
    select: { id: true },
    take: 2,
  })

  if (dupes.length > 1) {
    return { kind: "skip", reason: "multiple_active_contacts" }
  }

  if (dupes.length === 1) {
    if (APPLY) {
      await prisma.$transaction(
        async (tx) => {
          await linkEvidence(tx, candidate, dupes[0].id)
          await tx.contactPromotionCandidate.update({
            where: { id: candidate.id },
            data: {
              status: "merged",
              approvedContactId: dupes[0].id,
              metadata: buildReviewMetadata(candidate, "merged", dupes[0].id, "single_existing_contact_email_match", false),
            },
          })
        },
        { maxWait: 10_000, timeout: 60_000 }
      )
    }
    return { kind: "approve_link", contactId: dupes[0].id, reason: "single_existing_contact_email_match" }
  }

  // Count communications and check for Matt-outbound conversation
  const totalComms = await prisma.communication.count({
    where: {
      OR: [
        { contact: { email: { equals: email, mode: "insensitive" } } },
        { id: candidate.communicationId ?? "__none__" },
        ...(candidate.metadata?.communicationIds?.length
          ? [{ id: { in: candidate.metadata.communicationIds } }]
          : []),
      ],
    },
  })
  const mattOutbound = await prisma.communication.count({
    where: {
      direction: "outbound",
      OR: [
        { contact: { email: { equals: email, mode: "insensitive" } } },
        ...(candidate.metadata?.communicationIds?.length
          ? [{ id: { in: candidate.metadata.communicationIds } }]
          : []),
      ],
    },
  })

  const mattInitiated = candidate.sourceKind === "matt-outbound"

  if (mattInitiated || (mattOutbound > 0 && totalComms >= 2)) {
    if (APPLY) {
      const reason = mattInitiated
        ? "matt_initiated_outbound"
        : `matt_replied_+_${totalComms}_comms`
      await prisma.$transaction(
        async (tx) => {
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
        },
        { maxWait: 10_000, timeout: 60_000 }
      )
    }
    return {
      kind: "approve_create",
      reason: mattInitiated ? "matt_initiated_outbound" : `matt_replied_+_${totalComms}_comms`,
    }
  }

  return { kind: "skip", reason: "weak_evidence" }
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
  })

  // Only the no-decision rows
  const targets = candidates.filter((c) => !c.metadata?.autoPromotion?.decision)

  const tally = {
    targets: targets.length,
    approve_create: 0,
    approve_link: 0,
    not_a_contact: 0,
    skip: 0,
    errors: 0,
  }
  const errors = []

  for (const c of targets) {
    try {
      const r = await classifyAndApply(c)
      tally[r.kind]++
    } catch (e) {
      tally.errors++
      errors.push({ id: c.id, email: c.normalizedEmail, error: e?.message ?? String(e) })
    }
  }

  console.log(APPLY ? "Applied:" : "Dry run (no changes):")
  console.log(JSON.stringify(tally, null, 2))
  if (errors.length > 0) {
    console.log("\nErrors:")
    console.log(JSON.stringify(errors, null, 2))
  }
  if (!APPLY) console.log("\nRe-run with --apply to take these actions.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
