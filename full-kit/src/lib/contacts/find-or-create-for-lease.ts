import "server-only"

import type { ClientType, Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

/**
 * Find-or-create a Contact for a lease/sale extraction.
 *
 * Resolution order:
 *   1. If `contactEmail` is non-null and a non-archived Contact exists with
 *      that email (case-insensitive), use it.
 *   2. Otherwise, if a non-archived Contact exists with the same `name`
 *      (case-insensitive trimmed), use it.
 *   3. Otherwise, create a new Contact with the appropriate seed
 *      `clientType` based on `dealKind` + `mattRepresented`.
 *
 * Mirrors the pattern in `createDealFromAction` (`src/lib/ai/agent-actions-deal.ts`)
 * but seeds `clientType` instead of falling through to a follow-up
 * `syncContactRoleFromDeals` call. The orchestrator runs the lifecycle
 * helper after this returns, so a stale seed `clientType` is corrected
 * within the same transaction.
 */
export interface FindOrCreateContactInput {
  contactName: string
  contactEmail: string | null
  dealKind: "lease" | "sale"
  mattRepresented: "owner" | "tenant" | "both" | null
}

export type FindOrCreateOptions = Pick<FindOrCreateContactInput, never>

function seedClientType(
  dealKind: "lease" | "sale",
  mattRepresented: "owner" | "tenant" | "both" | null
): ClientType | null {
  if (!mattRepresented) return null
  if (mattRepresented === "tenant") return "active_buyer_rep_client"
  // owner | both — both default to listing-side seed.
  return "active_listing_client"
}

export async function findOrCreateContactForLease(
  input: FindOrCreateContactInput,
  tx: Prisma.TransactionClient | typeof db = db
): Promise<{ id: string; clientType: ClientType | null }> {
  const trimmedName = input.contactName.trim()

  // 1) email lookup (case-insensitive) — only if we have one.
  if (input.contactEmail) {
    const emailLower = input.contactEmail.toLowerCase()
    const byEmail = await tx.contact.findFirst({
      where: {
        email: { equals: emailLower, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true, clientType: true },
    })
    if (byEmail) return byEmail
  }

  // 2) name lookup (case-insensitive). Only the exact-trim match — fuzzy
  //    name matching belongs in the dedupe candidate flow, not here.
  if (trimmedName.length > 0) {
    const byName = await tx.contact.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true, clientType: true },
    })
    if (byName) return byName
  }

  // 3) create.
  const created = await tx.contact.create({
    data: {
      name: trimmedName.length > 0 ? trimmedName : (input.contactEmail ?? "(unknown)"),
      email: input.contactEmail ? input.contactEmail.toLowerCase() : null,
      category: "business",
      clientType: seedClientType(input.dealKind, input.mattRepresented),
      tags: ["auto-created-from-lease-backfill"],
      createdBy: "lease-pipeline-orchestrator",
    },
    select: { id: true, clientType: true },
  })
  return created
}
