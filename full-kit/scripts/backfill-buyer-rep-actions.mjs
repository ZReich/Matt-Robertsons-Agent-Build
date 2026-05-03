/**
 * Re-runs the Phase 10 buyer-rep detector against existing outbound
 * communications and creates AgentActions for any that match. Idempotent:
 * skips communications that already have a buyer-rep AgentAction.
 *
 * The Phase 10 hook in processOneMessage fires ONLY on fresh ingest. This
 * script provides retroactive coverage for outbound rows persisted before
 * the hook landed (or before the contactId-optional fix in fcea1e4 +
 * 87e84a9).
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   node scripts/backfill-buyer-rep-actions.mjs           # dry-run
 *   node scripts/backfill-buyer-rep-actions.mjs --apply
 */

import { createJiti } from "jiti"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.join(__dirname, "..", "src")

const apply = process.argv.includes("--apply")

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: { "@": SRC_DIR },
})

const detectorMod = await jiti.import(
  path.join(SRC_DIR, "lib", "deals", "buyer-rep-detector.ts")
)
const actionMod = await jiti.import(
  path.join(SRC_DIR, "lib", "deals", "buyer-rep-action.ts")
)
const classifyBuyerRepSignal =
  detectorMod.classifyBuyerRepSignal ??
  detectorMod.default?.classifyBuyerRepSignal
const proposeBuyerRepDeal =
  actionMod.proposeBuyerRepDeal ?? actionMod.default?.proposeBuyerRepDeal

if (!classifyBuyerRepSignal || !proposeBuyerRepDeal) {
  console.error("could not resolve detector/action exports")
  process.exit(1)
}

const { PrismaClient } = await import("@prisma/client")
const db = new PrismaClient()

const NAI_DOMAIN = "naibusinessproperties.com"

function extractRecipientDomains(toRecipients) {
  const out = new Set()
  for (const r of toRecipients ?? []) {
    const addr = r?.emailAddress?.address?.trim().toLowerCase()
    if (!addr || !addr.includes("@")) continue
    const domain = addr.split("@")[1]
    if (domain) out.add(domain)
  }
  return Array.from(out)
}

function pickFirstExternalRecipient(toRecipients, senderAddress) {
  for (const r of toRecipients ?? []) {
    const email = r?.emailAddress?.address?.trim().toLowerCase()
    if (!email || !email.includes("@")) continue
    if (senderAddress && email === senderAddress.toLowerCase()) continue
    if (email.endsWith("@" + NAI_DOMAIN)) continue
    return {
      email,
      displayName: r?.emailAddress?.name?.trim() || null,
    }
  }
  return null
}

async function main() {
  // Find outbound rows that haven't already produced a buyer-rep AgentAction.
  const rows = await db.communication.findMany({
    where: {
      direction: "outbound",
      sourceAgentActions: { none: { actionType: "create-deal" } },
    },
    select: {
      id: true,
      subject: true,
      body: true,
      contactId: true,
      metadata: true,
    },
  })
  console.log(
    `Outbound rows without buyer-rep action: ${rows.length} (mode=${apply ? "apply" : "dry-run"})`
  )

  const stats = {
    examined: 0,
    matched: 0,
    actionCreated: 0,
    // Phase D step 3 outcome breakdown:
    //   autoTierCount: LOI proposals with matching-filename attachment
    //   loggedAuditOnly: tenant_rep_search log_only audit rows (no dedupe)
    // Both counters are subsets of actionCreated (or, for log_only, parallel
    // to it — see code below).
    autoTierCount: 0,
    loggedAuditOnly: 0,
    skippedExistingDeal: 0,
    skippedDuplicatePending: 0,
    skippedNoSignal: 0,
    skippedNoExternalRecipient: 0,
    errors: 0,
  }
  const matchedSignalBreakdown = {
    loi: 0,
    tour: 0,
    nda: 0,
    tenant_rep_search: 0,
  }
  const samples = []

  for (const row of rows) {
    stats.examined++
    const meta = row.metadata ?? {}
    const senderAddress = meta?.from?.address ?? meta?.sender?.address ?? ""
    const toRecipients = Array.isArray(meta?.toRecipients)
      ? meta.toRecipients
      : []
    const recipientDomains = extractRecipientDomains(toRecipients)

    const signal = classifyBuyerRepSignal({
      direction: "outbound",
      subject: row.subject ?? "",
      body: typeof row.body === "string" ? row.body : "",
      recipientDomains,
    })
    if (!signal.signalType || !signal.proposedStage) {
      stats.skippedNoSignal++
      continue
    }
    stats.matched++
    if (signal.signalType in matchedSignalBreakdown) {
      matchedSignalBreakdown[signal.signalType]++
    }

    const externalRecipient = pickFirstExternalRecipient(
      toRecipients,
      senderAddress
    )
    let contactId = row.contactId ?? null
    if (!contactId && externalRecipient?.email) {
      const match = await db.contact.findFirst({
        where: {
          email: { equals: externalRecipient.email, mode: "insensitive" },
          archivedAt: null,
        },
        select: { id: true },
      })
      if (match) contactId = match.id
    }
    if (!contactId && !externalRecipient?.email) {
      stats.skippedNoExternalRecipient++
      continue
    }

    // Dry-run tier preview: mirrors the logic inside proposeBuyerRepDeal so
    // we can show what the apply pass WOULD produce without calling it.
    const attachments = Array.isArray(meta?.attachments) ? meta.attachments : []
    const loiFilenameMatch = attachments.some(
      (a) =>
        typeof a?.name === "string" &&
        /loi|letter[-_ ]of[-_ ]intent|offer/i.test(a.name)
    )
    let predictedTier = "approve"
    if (signal.signalType === "tenant_rep_search") {
      predictedTier = "log_only"
    } else if (signal.signalType === "loi" && loiFilenameMatch) {
      predictedTier = "auto"
    }

    if (samples.length < 10) {
      samples.push({
        commId: row.id,
        subject: row.subject?.slice(0, 80),
        signalType: signal.signalType,
        proposedStage: signal.proposedStage,
        predictedTier,
        attachmentNames: attachments
          .map((a) => a?.name)
          .filter(Boolean)
          .slice(0, 3),
        contactIdResolved: !!contactId,
        recipient: externalRecipient?.email,
      })
    }

    if (!apply) {
      // Pre-tally what apply would produce so the dry-run output is decisive.
      if (predictedTier === "log_only") stats.loggedAuditOnly++
      else if (predictedTier === "auto") stats.autoTierCount++
    }

    if (apply) {
      try {
        const result = await proposeBuyerRepDeal({
          communicationId: row.id,
          contactId,
          recipientEmail: externalRecipient?.email ?? null,
          recipientDisplayName: externalRecipient?.displayName ?? null,
          signalType: signal.signalType,
          proposedStage: signal.proposedStage,
          confidence: signal.confidence,
        })
        if (result.created) {
          stats.actionCreated++
          if (result.tier === "log_only") stats.loggedAuditOnly++
          else if (result.tier === "auto") stats.autoTierCount++
        } else if (result.skipReason === "existing-buyer-rep-deal") {
          stats.skippedExistingDeal++
        } else if (result.skipReason === "duplicate-pending-action") {
          stats.skippedDuplicatePending++
        }
      } catch (err) {
        stats.errors++
        console.error(`error on ${row.id}:`, err.message)
      }
    }
  }

  console.log(
    JSON.stringify({ stats, matchedSignalBreakdown, samples }, null, 2)
  )
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
