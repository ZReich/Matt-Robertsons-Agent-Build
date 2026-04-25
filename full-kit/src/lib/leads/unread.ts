import type { LeadStatus } from "@prisma/client"

export interface IsUnreadInput {
  leadStatus: LeadStatus | null
  leadAt: Date | null
  leadLastViewedAt: Date | null
  communications: Array<{
    direction: "inbound" | "outbound" | null
    date: Date
  }>
}

export function isUnread(input: IsUnreadInput): boolean {
  if (input.leadStatus === "new") return true

  const baseline = input.leadLastViewedAt ?? input.leadAt
  if (!baseline) return false

  return input.communications.some(
    (communication) =>
      communication.direction === "inbound" && communication.date > baseline
  )
}
