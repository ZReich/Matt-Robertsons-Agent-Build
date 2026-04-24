import type { Prisma } from "@prisma/client"
import type { ScrubOutput, SuggestedAction } from "./scrub-types"

import { db } from "@/lib/prisma"

import { PROMPT_VERSION } from "./scrub-types"

export class ScrubFencedOutError extends Error {
  code = "SCRUB_FENCED_OUT" as const

  constructor(queueRowId: string) {
    super(`Scrub queue row ${queueRowId} was claimed by another worker`)
  }
}

/**
 * Commit a scrub result transactionally with a single fencing check.
 *
 * The spec-mandated invariant: the scrub_queue row MUST still carry the
 * leaseToken we were issued at claim time, otherwise another worker has
 * re-claimed the row and our writes would duplicate its work.
 *
 * We enforce this by using the `scrub_queue` row as both the fence AND
 * the commit marker: a single conditional update transitions status from
 * 'in_flight' → 'done' AND clears the lease, guarded by leaseToken.
 * If that update affects 0 rows, we throw before writing any Communication
 * metadata or AgentAction rows, so the fence is atomic with the commit.
 */
export async function applyScrubResult({
  communicationId,
  queueRowId,
  leaseToken,
  scrubOutput,
  suggestedActions,
}: {
  communicationId: string
  queueRowId: string
  leaseToken: string
  scrubOutput: ScrubOutput
  suggestedActions: SuggestedAction[]
}): Promise<void> {
  await db.$transaction(async (tx) => {
    // Fence + commit marker in one conditional update.
    // If leaseToken has been rotated by another worker, count === 0
    // and we throw before any other writes happen.
    const fence = await tx.scrubQueue.updateMany({
      where: {
        id: queueRowId,
        leaseToken,
        status: "in_flight",
      },
      data: {
        status: "done",
        lockedUntil: null,
        leaseToken: null,
        lastError: null,
        promptVersion: scrubOutput.promptVersion || PROMPT_VERSION,
      },
    })
    if (fence.count !== 1) {
      throw new ScrubFencedOutError(queueRowId)
    }

    // Past this point we hold exclusive write rights for this row.
    const comm = await tx.communication.findUnique({
      where: { id: communicationId },
      select: { metadata: true },
    })
    const existingMetadata =
      comm?.metadata &&
      typeof comm.metadata === "object" &&
      !Array.isArray(comm.metadata)
        ? comm.metadata
        : {}

    await tx.communication.update({
      where: { id: communicationId },
      data: {
        metadata: {
          ...existingMetadata,
          scrub: scrubOutput,
        } as Prisma.InputJsonValue,
      },
    })

    for (const action of suggestedActions) {
      await tx.agentAction.create({
        data: {
          actionType: action.actionType,
          tier: "approve",
          status: "pending",
          summary: action.summary,
          targetEntity: `communication:${communicationId}`,
          payload: action.payload as Prisma.InputJsonValue,
        },
      })
    }
  })
}
