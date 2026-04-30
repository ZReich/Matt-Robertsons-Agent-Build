// One-off backfill: derive Contact.clientType from each contact's deal portfolio.
//
// Mirrors src/lib/contacts/sync-contact-role.ts::syncContactRoleFromDeals.
// The logic is intentionally duplicated (not imported) so this script has no
// TypeScript build dependency — same pattern as backfill-contact-names.mjs.
//
// Safe to run multiple times; the function is idempotent.
//
// Run with:
//   cd full-kit
//   set -a && source .env.local && set +a
//   node scripts/backfill-contact-client-type.mjs

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function syncContactRoleFromDeals(contactId) {
  const deals = await db.deal.findMany({
    where: { contactId, archivedAt: null },
    select: { dealType: true, stage: true, outcome: true },
  })

  let nextRole = null

  if (deals.length === 0) {
    nextRole = null
  } else {
    const hasActiveBuyerRep = deals.some(
      (d) => d.dealType === "buyer_rep" && d.stage !== "closed"
    )
    const hasActiveListing = deals.some(
      (d) => d.dealType === "seller_rep" && d.stage !== "closed"
    )
    const allClosed = deals.every((d) => d.stage === "closed")
    const anyWon = deals.some((d) => d.outcome === "won")

    if (hasActiveBuyerRep) nextRole = "active_buyer_rep_client"
    else if (hasActiveListing) nextRole = "active_listing_client"
    else if (allClosed && anyWon) nextRole = "past_client"
    else nextRole = "prospect"
  }

  await db.contact.update({
    where: { id: contactId },
    data: { clientType: nextRole },
  })
}

async function main() {
  const contacts = await db.contact.findMany({ select: { id: true } })
  console.log(`Syncing ${contacts.length} contacts`)
  for (const c of contacts) {
    await syncContactRoleFromDeals(c.id)
  }
  console.log("done")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
