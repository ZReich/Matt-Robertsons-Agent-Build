import {
  isBlockedAutomationAddress,
  isRoleAccount,
} from "@/lib/contact-auto-promotion-policy"
import { db } from "@/lib/prisma"

export type DeterministicMatchResult =
  | { kind: "unique"; contactId: string }
  | { kind: "multiple" }
  | { kind: "none" }
  | { kind: "blocked"; reason: DeterministicBlockReason }

export type DeterministicBlockReason =
  | "invalid_email"
  | "internal_sender"
  | "role_account"
  | "automation_or_platform_address"

type ContactQueryClient = {
  contact: {
    findMany: (args: {
      where: {
        email: { equals: string; mode: "insensitive" }
        archivedAt: null
      }
      select: { id: true }
      take: number
    }) => Promise<Array<{ id: string }>>
  }
}

export async function resolveDeterministicContactMatch(
  input: { email: string | null | undefined; isInternal?: boolean | null },
  client: ContactQueryClient = db as unknown as ContactQueryClient
): Promise<DeterministicMatchResult> {
  const normalized = normalizeEmail(input.email)
  if (!normalized) return { kind: "blocked", reason: "invalid_email" }

  if (input.isInternal === true) {
    return { kind: "blocked", reason: "internal_sender" }
  }

  if (isBlockedAutomationAddress(normalized)) {
    return { kind: "blocked", reason: "automation_or_platform_address" }
  }
  if (isRoleAccount(normalized)) {
    return { kind: "blocked", reason: "role_account" }
  }

  const matches = await client.contact.findMany({
    where: {
      email: { equals: normalized, mode: "insensitive" },
      archivedAt: null,
    },
    select: { id: true },
    take: 2,
  })

  if (matches.length === 0) return { kind: "none" }
  if (matches.length > 1) return { kind: "multiple" }
  return { kind: "unique", contactId: matches[0].id }
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const atIdx = trimmed.indexOf("@")
  if (atIdx <= 0 || atIdx === trimmed.length - 1) return null
  return trimmed
}
