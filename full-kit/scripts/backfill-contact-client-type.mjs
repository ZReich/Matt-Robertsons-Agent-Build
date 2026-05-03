// Backfill: derive Contact.clientType from each contact's deal portfolio,
// using the Phase C richer past-client logic (past_listing_client /
// past_buyer_client) and migrating any legacy `past_client` rows to the
// correct variant.
//
// Mirrors src/lib/contacts/role-lifecycle.ts::nextClientType. The logic is
// intentionally duplicated (not imported) so this script has no TypeScript
// build dependency — same pattern as backfill-contact-names.mjs. KEEP IN SYNC
// with role-lifecycle.ts when the rules change.
//
// Defaults to dry-run. Pass --apply to write changes. Pass --migrate-past-client
// to scope the run to contacts whose current clientType is the legacy
// `past_client` value (otherwise: walk every contact with at least one deal,
// which also corrects any other mis-classifications).
//
// Run with:
//   cd full-kit
//   set -a && source .env.local && set +a
//   node scripts/backfill-contact-client-type.mjs                  # dry-run, all
//   node scripts/backfill-contact-client-type.mjs --apply          # write, all
//   node scripts/backfill-contact-client-type.mjs --migrate-past-client          # dry, legacy only
//   node scripts/backfill-contact-client-type.mjs --migrate-past-client --apply  # write, legacy only

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const args = new Set(process.argv.slice(2))
const APPLY = args.has("--apply")
const LEGACY_ONLY = args.has("--migrate-past-client")

// Pure function — KEEP IN SYNC with src/lib/contacts/role-lifecycle.ts.
function nextClientType(deals) {
  if (deals.length === 0) return null

  const hasActiveBuyerSide = deals.some(
    (d) =>
      (d.dealType === "buyer_rep" || d.dealType === "tenant_rep") &&
      d.stage !== "closed"
  )
  if (hasActiveBuyerSide) return "active_buyer_rep_client"

  const hasActiveListing = deals.some(
    (d) => d.dealType === "seller_rep" && d.stage !== "closed"
  )
  if (hasActiveListing) return "active_listing_client"

  const closed = deals.filter((d) => d.stage === "closed")
  if (closed.length === 0) return null

  const sorted = [...closed].sort((a, b) => {
    const aTs = a.closedAt ? new Date(a.closedAt).getTime() : -Infinity
    const bTs = b.closedAt ? new Date(b.closedAt).getTime() : -Infinity
    return bTs - aTs
  })

  const winner = sorted[0]
  if (winner.dealType === "seller_rep") return "past_listing_client"
  return "past_buyer_client"
}

async function main() {
  const where = { archivedAt: null }
  if (LEGACY_ONLY) where.clientType = "past_client"

  const contacts = await db.contact.findMany({
    where,
    select: { id: true, name: true, clientType: true },
  })

  console.log(
    `Mode: ${APPLY ? "APPLY" : "DRY-RUN"} | Scope: ${
      LEGACY_ONLY ? "legacy past_client only" : "all non-archived contacts"
    }`
  )
  console.log(`Inspecting ${contacts.length} contacts`)

  const transitions = new Map() // "from→to" → count
  const changes = []
  let nullSkipped = 0

  for (const c of contacts) {
    const deals = await db.deal.findMany({
      where: { contactId: c.id, archivedAt: null },
      select: { dealType: true, stage: true, outcome: true, closedAt: true },
    })

    const next = nextClientType(deals)

    if (next === c.clientType) continue
    if (next === null && c.clientType === null) {
      nullSkipped++
      continue
    }

    const key = `${c.clientType ?? "null"} → ${next ?? "null"}`
    transitions.set(key, (transitions.get(key) ?? 0) + 1)
    changes.push({ id: c.id, name: c.name, from: c.clientType, to: next })
  }

  console.log(`\nTransitions (${changes.length} contacts would change):`)
  for (const [key, n] of [...transitions.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${n.toString().padStart(4)}  ${key}`)
  }

  if (changes.length === 0) {
    console.log("Nothing to do.")
    return
  }

  // Show a small sample so reviewer can spot-check.
  console.log("\nSample (first 10):")
  for (const c of changes.slice(0, 10)) {
    console.log(
      `  ${c.id}  ${(c.name ?? "").padEnd(30)}  ${c.from ?? "null"} → ${
        c.to ?? "null"
      }`
    )
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to write.")
    return
  }

  console.log("\nApplying...")
  let written = 0
  for (const c of changes) {
    await db.contact.update({
      where: { id: c.id },
      data: { clientType: c.to },
    })
    written++
  }
  console.log(`Updated ${written} contacts.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
