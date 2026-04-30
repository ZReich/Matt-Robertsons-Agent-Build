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
    skippedNoSignal: 0,
    skippedNoExternalRecipient: 0,
    errors: 0,
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

    if (samples.length < 10) {
      samples.push({
        commId: row.id,
        subject: row.subject?.slice(0, 80),
        signalType: signal.signalType,
        proposedStage: signal.proposedStage,
        contactIdResolved: !!contactId,
        recipient: externalRecipient?.email,
      })
    }

    if (apply) {
      try {
        await proposeBuyerRepDeal({
          communicationId: row.id,
          contactId,
          recipientEmail: externalRecipient?.email ?? null,
          recipientDisplayName: externalRecipient?.displayName ?? null,
          signalType: signal.signalType,
          proposedStage: signal.proposedStage,
          confidence: signal.confidence,
        })
        stats.actionCreated++
      } catch (err) {
        stats.errors++
        console.error(`error on ${row.id}:`, err.message)
      }
    }
  }

  console.log(JSON.stringify({ stats, samples }, null, 2))
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
