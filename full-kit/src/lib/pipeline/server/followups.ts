import type { Direction } from "@prisma/client"

export interface FollowupCommunication {
  id?: string
  subject?: string | null
  body?: string | null
  date: Date
  direction: Direction | "inbound" | "outbound" | null
}

export function selectMissedFollowupReference<
  TCommunication extends FollowupCommunication,
>(communications: TCommunication[], cutoff: Date): TCommunication | null {
  const actionableInbound = communications
    .filter(
      (communication) =>
        communication.direction === "inbound" && communication.date < cutoff
    )
    .filter(
      (inbound) =>
        !communications.some(
          (candidateReply) =>
            candidateReply.direction === "outbound" &&
            candidateReply.date > inbound.date
        )
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  return actionableInbound[0] ?? null
}

export function hasMissedFollowup(
  communications: FollowupCommunication[],
  cutoff: Date
) {
  return selectMissedFollowupReference(communications, cutoff) != null
}

export function getMissedFollowupCutoff(now = new Date()) {
  return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
}
