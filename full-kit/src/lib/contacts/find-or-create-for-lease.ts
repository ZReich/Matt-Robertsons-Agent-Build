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
 *   3. Otherwise, create a new Contact with `clientType: null`. The
 *      orchestrator immediately sets the correct `clientType` via
 *      `nextClientTypeForLease` after this returns, so any seed value we
 *      set here would be overwritten and never observed. We deliberately
 *      do NOT seed clientType here — let the lifecycle helper own that.
 *
 * Also performs lightweight validation on `contactName` to avoid creating
 * garbage Contact rows from AI hallucinations: rejects names shorter than
 * 2 trimmed chars, names that look like email subject prefixes ("Re:"
 * / "Fwd:"), or common placeholder strings ("unknown", "n/a", "tbd",
 * "placeholder", "---"). When the name is unusable but `contactEmail` is
 * present, falls back to the email as the display name. When both are
 * unusable, returns `null` — the orchestrator treats that as a
 * `low_confidence` outcome with no DB writes.
 */
export interface FindOrCreateContactInput {
  contactName: string
  contactEmail: string | null
  dealKind: "lease" | "sale"
  mattRepresented: "owner" | "tenant" | "both" | null
}

export type FindOrCreateOptions = Pick<FindOrCreateContactInput, never>

const PLACEHOLDER_NAME_PATTERN = /^(unknown|n\/a|tbd|placeholder|---)/i
const SUBJECT_PREFIX_PATTERN = /^(re|fwd|fw)\s*:/i

/**
 * Returns true when `name` looks like a real person/company name, false
 * when it looks like a hallucinated placeholder, an email subject prefix,
 * or is too short to be meaningful.
 */
export function isUsableContactName(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length < 2) return false
  if (SUBJECT_PREFIX_PATTERN.test(trimmed)) return false
  if (PLACEHOLDER_NAME_PATTERN.test(trimmed)) return false
  return true
}

export async function findOrCreateContactForLease(
  input: FindOrCreateContactInput,
  tx: Prisma.TransactionClient | typeof db = db
): Promise<{ id: string; clientType: ClientType | null } | null> {
  const trimmedName = input.contactName.trim()

  // Validate name. If the AI handed us garbage, fall back to email; if
  // both are unusable, return null so the orchestrator can record a
  // low_confidence failure and skip all DB writes.
  let displayName: string
  if (isUsableContactName(trimmedName)) {
    displayName = trimmedName
  } else if (input.contactEmail && input.contactEmail.trim().length > 0) {
    displayName = input.contactEmail.toLowerCase()
  } else {
    return null
  }

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
  //    name matching belongs in the dedupe candidate flow, not here. Skip
  //    when we fell back to email (the email already drove the lookup).
  if (isUsableContactName(trimmedName)) {
    const byName = await tx.contact.findFirst({
      where: {
        name: { equals: trimmedName, mode: "insensitive" },
        archivedAt: null,
      },
      select: { id: true, clientType: true },
    })
    if (byName) return byName
  }

  // 3) create. clientType: null — the orchestrator's nextClientTypeForLease
  //    call sets the correct role two lines after this returns.
  const created = await tx.contact.create({
    data: {
      name: displayName,
      email: input.contactEmail ? input.contactEmail.toLowerCase() : null,
      category: "business",
      clientType: null,
      tags: ["auto-created-from-lease-backfill"],
      createdBy: "lease-pipeline-orchestrator",
    },
    select: { id: true, clientType: true },
  })
  return created
}
