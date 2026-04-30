import { Prisma } from "@prisma/client"

import { syncContactRoleFromDeals } from "@/lib/contacts/sync-contact-role"
import { db } from "@/lib/prisma"

export type LeadDealUpsertInput = {
  contactId: string
  communicationId: string
  propertyKey: string | null
  propertyAddress: string | null
  propertySource: "buildout" | "crexi" | "loopnet"
}

export type LeadDealUpsertResult = {
  dealId: string | null
  created: boolean
}

export async function upsertDealForLead(
  input: LeadDealUpsertInput
): Promise<LeadDealUpsertResult> {
  if (!input.propertyKey) {
    return { dealId: null, created: false }
  }

  // Match the partial-unique-index scope from the Phase 1 repair migration:
  // (deal_type='seller_rep' AND archived_at IS NULL AND property_key IS NOT NULL).
  // Filtering by dealType ensures we don't link a lead to a stale buyer-rep
  // deal that happens to share the same propertyKey.
  const findExisting = () =>
    db.deal.findFirst({
      where: {
        propertyKey: input.propertyKey,
        dealType: "seller_rep",
        archivedAt: null,
      },
      select: { id: true, propertyAliases: true },
    })

  const existing = await findExisting()
  if (existing) {
    await db.communication.update({
      where: { id: input.communicationId },
      data: { dealId: existing.id },
    })
    await syncContactRoleFromDeals(input.contactId)
    return { dealId: existing.id, created: false }
  }

  // Race window: another worker may insert a matching seller_rep Deal between
  // findFirst and create. The partial unique index makes that race safe — the
  // second create throws P2002, which we catch and treat as "found existing"
  // by re-running findFirst.
  let createdDealId: string
  try {
    const created = await db.deal.create({
      data: {
        contactId: input.contactId,
        propertyKey: input.propertyKey,
        propertyAddress: input.propertyAddress,
        dealType: "seller_rep",
        dealSource: "lead_derived",
        stage: "marketing",
        propertyAliases: [],
      },
      select: { id: true },
    })
    createdDealId = created.id
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const racedTo = await findExisting()
      if (!racedTo) throw err // unique violation but no row found — re-throw
      await db.communication.update({
        where: { id: input.communicationId },
        data: { dealId: racedTo.id },
      })
      await syncContactRoleFromDeals(input.contactId)
      return { dealId: racedTo.id, created: false }
    }
    throw err
  }
  await db.communication.update({
    where: { id: input.communicationId },
    data: { dealId: createdDealId },
  })
  await syncContactRoleFromDeals(input.contactId)
  return { dealId: createdDealId, created: true }
}
