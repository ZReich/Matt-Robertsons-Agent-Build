import type { ClientType } from "@prisma/client"

import { db } from "@/lib/prisma"

export async function syncContactRoleFromDeals(contactId: string): Promise<void> {
  const deals = await db.deal.findMany({
    where: { contactId, archivedAt: null },
    select: { dealType: true, stage: true, outcome: true },
  })

  let nextRole: ClientType | null = null

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
