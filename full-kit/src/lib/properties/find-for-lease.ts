import "server-only"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import { computePropertyKey } from "@/lib/properties/property-utils"

/**
 * Look up a `Property` for a lease/sale extraction's `propertyAddress`.
 *
 * Strategy:
 *   1. Pass the raw address through `computePropertyKey()` (which uses the
 *      Buildout normalizer the lead pipeline uses) and match on
 *      `Property.propertyKey` exactly.
 *   2. If that misses, fall back to a case-insensitive equality match on
 *      `Property.address`.
 *   3. Return `null` if both miss — the orchestrator then writes
 *      `LeaseRecord.propertyId = null` (this is the documented missing-
 *      property fallback path).
 *
 * Side effect: returning `null` is fine. We deliberately do NOT
 * auto-create a `Property` here — Properties are catalog rows that come
 * from Buildout/manual entry; auto-creating them from email-extracted
 * addresses would pollute the catalog.
 */
export interface FindPropertyInput {
  propertyAddress: string | null
}

export type FindPropertyOptions = Pick<FindPropertyInput, never>

export async function findPropertyForLease(
  input: FindPropertyInput,
  tx: Prisma.TransactionClient | typeof db = db
): Promise<{ id: string; address: string } | null> {
  const raw = input.propertyAddress?.trim()
  if (!raw) return null

  const key = computePropertyKey({ address: raw })
  if (key) {
    const byKey = await tx.property.findFirst({
      where: { propertyKey: key, archivedAt: null },
      select: { id: true, address: true },
      orderBy: { createdAt: "asc" },
    })
    if (byKey) return byKey
  }

  const byAddress = await tx.property.findFirst({
    where: {
      address: { equals: raw, mode: "insensitive" },
      archivedAt: null,
    },
    select: { id: true, address: true },
    orderBy: { createdAt: "asc" },
  })
  return byAddress ?? null
}
