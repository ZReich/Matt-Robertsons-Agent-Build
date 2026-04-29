import type { Prisma } from "@prisma/client"
import type {
  ContactProfileFactSuggestion,
  ScrubOutput,
  SuggestedAction,
} from "./scrub-types"

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
      select: { metadata: true, contactId: true, date: true },
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

    const pendingMarkTodoDoneTargets = new Set<string>()
    for (const action of suggestedActions) {
      const targetEntity = getActionTargetEntity(action)
      if (action.actionType === "mark-todo-done") {
        if (!targetEntity) continue
        if (pendingMarkTodoDoneTargets.has(targetEntity)) continue
        pendingMarkTodoDoneTargets.add(targetEntity)
        const existing = await tx.agentAction.findFirst({
          where: {
            actionType: "mark-todo-done",
            status: "pending",
            targetEntity,
          },
          select: { id: true },
        })
        if (existing) continue
      }
      try {
        await tx.agentAction.create({
          data: {
            actionType: action.actionType,
            tier: "approve",
            status: "pending",
            summary: action.summary,
            sourceCommunicationId: communicationId,
            promptVersion: scrubOutput.promptVersion || PROMPT_VERSION,
            targetEntity,
            payload: action.payload as Prisma.InputJsonValue,
          },
        })
      } catch (error) {
        if (action.actionType === "mark-todo-done" && isUniqueConflict(error)) {
          continue
        }
        throw error
      }
    }

    if (comm && shouldPersistProfileFacts()) {
      for (const fact of scrubOutput.profileFacts ?? []) {
        const contactId = comm.contactId
        if (shouldDropProfileFact(fact)) continue
        if (!shouldAutoSaveProfileFact(fact, communicationId, contactId)) {
          if (shouldReviewProfileFact(fact, communicationId, contactId)) {
            const existing = await tx.contactProfileFact.findUnique({
              where: {
                contactId_normalizedKey: {
                  contactId,
                  normalizedKey: fact.normalizedKey,
                },
              },
              select: { status: true },
            })
            if (existing?.status === "active") continue
            const create = {
              contactId,
              category: fact.category,
              fact: fact.fact,
              normalizedKey: fact.normalizedKey,
              confidence: fact.confidence,
              wordingClass: fact.wordingClass,
              sourceCommunicationId: communicationId,
              observedAt: fact.observedAt
                ? new Date(fact.observedAt)
                : comm.date,
              lastSeenAt: comm.date,
              expiresAt: fact.expiresAt ? new Date(fact.expiresAt) : null,
              status: "review",
              metadata: buildFactMetadata(fact, scrubOutput),
            } satisfies Prisma.ContactProfileFactUncheckedCreateInput
            await tx.contactProfileFact.upsert({
              where: {
                contactId_normalizedKey: {
                  contactId,
                  normalizedKey: fact.normalizedKey,
                },
              },
              create,
              update: {
                category: fact.category,
                fact: fact.fact,
                confidence: fact.confidence,
                wordingClass: fact.wordingClass,
                sourceCommunicationId: communicationId,
                lastSeenAt: comm.date,
                expiresAt: fact.expiresAt ? new Date(fact.expiresAt) : null,
                status: "review",
                metadata: buildFactMetadata(fact, scrubOutput),
              },
            })
          }
          continue
        }
        await tx.contactProfileFact.upsert({
          where: {
            contactId_normalizedKey: {
              contactId,
              normalizedKey: fact.normalizedKey,
            },
          },
          create: {
            contactId,
            category: fact.category,
            fact: fact.fact,
            normalizedKey: fact.normalizedKey,
            confidence: fact.confidence,
            wordingClass: fact.wordingClass,
            sourceCommunicationId: communicationId,
            observedAt: fact.observedAt ? new Date(fact.observedAt) : comm.date,
            lastSeenAt: comm.date,
            expiresAt: fact.expiresAt ? new Date(fact.expiresAt) : null,
            status: "active",
            metadata: buildFactMetadata(fact, scrubOutput),
          },
          update: {
            category: fact.category,
            fact: fact.fact,
            confidence: fact.confidence,
            wordingClass: fact.wordingClass,
            sourceCommunicationId: communicationId,
            lastSeenAt: comm.date,
            expiresAt: fact.expiresAt ? new Date(fact.expiresAt) : null,
            status: "active",
            metadata: buildFactMetadata(fact, scrubOutput),
          },
        })
      }
    }
  })
}

function shouldReviewProfileFact(
  fact: ContactProfileFactSuggestion,
  communicationId: string,
  linkedContactId: string | null
): linkedContactId is string {
  if (!linkedContactId) return false
  if (fact.contactId !== linkedContactId) return false
  if (fact.sourceCommunicationId !== communicationId) return false
  if (fact.expiresAt && new Date(fact.expiresAt).getTime() <= Date.now()) {
    return false
  }
  return (
    fact.confidence < 0.85 ||
    fact.wordingClass === "caution" ||
    FORBIDDEN_AUTO_FACT_PATTERN.test(fact.fact)
  )
}

function shouldPersistProfileFacts(): boolean {
  const mode = process.env.PROFILE_FACT_EXTRACTION_MODE
  return mode === "live_only" || mode === "targeted_replay" || mode === "write"
}

const FORBIDDEN_AUTO_FACT_PATTERN =
  /\b(disability|diagnosis|pregnant|pregnancy|religion|citizenship|bankrupt|bankruptcy|addict|addiction|depressed|anxious|cancer|divorce|lawsuit|legal trouble|debt|medical|health issue|ssn|social security)\b/i

function shouldDropProfileFact(fact: ContactProfileFactSuggestion): boolean {
  return (
    FORBIDDEN_AUTO_FACT_PATTERN.test(fact.fact) ||
    (fact.evidence ? FORBIDDEN_AUTO_FACT_PATTERN.test(fact.evidence) : false)
  )
}

function shouldAutoSaveProfileFact(
  fact: ContactProfileFactSuggestion,
  communicationId: string,
  linkedContactId: string | null
): linkedContactId is string {
  if (!linkedContactId) return false
  if (fact.contactId !== linkedContactId) return false
  if (fact.sourceCommunicationId !== communicationId) return false
  if (fact.confidence < 0.85) return false
  if (fact.wordingClass === "caution") return false
  if (fact.expiresAt && new Date(fact.expiresAt).getTime() <= Date.now()) {
    return false
  }
  return true
}

function buildFactMetadata(
  fact: ContactProfileFactSuggestion,
  scrubOutput: ScrubOutput
): Prisma.InputJsonValue {
  return {
    evidence: redactFactEvidence(fact.evidence),
    promptVersion: scrubOutput.promptVersion || PROMPT_VERSION,
    modelUsed: scrubOutput.modelUsed,
    savedBy: "scrub-profile-fact",
  } as Prisma.InputJsonValue
}

function redactFactEvidence(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[redacted-token]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240)
}

function getActionTargetEntity(action: SuggestedAction): string | null {
  const payload = action.payload
  const dealId = typeof payload.dealId === "string" ? payload.dealId : null
  const contactId =
    typeof payload.contactId === "string" ? payload.contactId : null
  const meetingId =
    typeof payload.meetingId === "string" ? payload.meetingId : null

  if (action.actionType === "move-deal-stage" && dealId) return `deal:${dealId}`
  if (action.actionType === "update-deal" && dealId) return `deal:${dealId}`
  if (action.actionType === "create-meeting" && dealId) return `deal:${dealId}`
  if (action.actionType === "update-meeting" && meetingId) {
    return `meeting:${meetingId}`
  }
  if (action.actionType === "mark-todo-done") {
    const todoId = typeof payload.todoId === "string" ? payload.todoId : null
    const targetEntity =
      typeof payload.targetEntity === "string" ? payload.targetEntity : null
    if (!todoId || !isSafeEntityId(todoId)) return null
    const canonical = `todo:${todoId}`
    if (targetEntity && targetEntity !== canonical) return null
    return canonical
  }
  if (action.actionType === "create-agent-memory") {
    if (dealId) return `deal:${dealId}`
    if (contactId) return `contact:${contactId}`
  }
  return null
}

function isSafeEntityId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id)
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as { code?: string }).code === "P2002" ||
      (error as { code?: string }).code === "23505")
  )
}
