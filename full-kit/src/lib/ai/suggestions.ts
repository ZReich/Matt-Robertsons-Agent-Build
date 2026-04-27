import type { AgentActionStatus, Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import { PROMPT_RELEASED_AT, PROMPT_VERSION } from "./scrub-types"

export type AiSuggestionState = {
  entityType: "contact" | "deal" | "communication"
  entityId: string
  surface?: "lead"
  queue: Record<
    "notQueued" | "pending" | "inFlight" | "done" | "failed",
    number
  >
  scrubbedCommunications: Array<{
    communicationId: string
    subject: string | null
    date: string
    summary: string | null
    urgency: string | null
    replyRequired: boolean | null
    topicTags: string[]
  }>
  actions: AiSuggestionAction[]
}

export type AiSuggestionAction = {
  id: string
  actionType: string
  status: AgentActionStatus
  tier: string
  summary: string
  payload: Prisma.JsonValue
  sourceCommunicationId: string | null
  targetEntity: string | null
  evidence: {
    subject: string | null
    date: string | null
    summary: string | null
    outlookUrl: string | null
  } | null
  promptVersion: string
  createdAt: string
  isStale: boolean
  staleReason: string | null
  isSnoozed: boolean
  snoozedUntil: string | null
  duplicateOfActionId: string | null
  dedupedToTodoId: string | null
  linkedContactCandidates: LinkedCandidateChip[]
  linkedDealCandidates: LinkedCandidateChip[]
  hasMoreLinkedCandidates: boolean
}

type LinkedCandidateChip = {
  kind: "contact" | "deal"
  id: string
  label: string
  confidence: number
  reason: string
  matchedVia?: string
}

export async function getAiSuggestionState({
  entityType,
  entityId,
  surface,
}: {
  entityType: "contact" | "deal" | "communication"
  entityId: string
  surface?: "lead"
}): Promise<AiSuggestionState> {
  const communications = await findEntityCommunications(entityType, entityId)
  const communicationIds = communications.map(
    (communication) => communication.id
  )
  const actions = communicationIds.length
    ? await db.agentAction.findMany({
        where: { sourceCommunicationId: { in: communicationIds } },
        orderBy: { createdAt: "desc" },
        include: {
          sourceCommunication: {
            select: {
              id: true,
              archivedAt: true,
              metadata: true,
              subject: true,
              date: true,
              externalMessageId: true,
            },
          },
        },
      })
    : []
  const snoozes = actions.length
    ? await db.todoReminderPolicy.findMany({
        where: {
          agentActionId: { in: actions.map((action) => action.id) },
          state: "snoozed",
        },
      })
    : []
  const snoozeByAction = new Map(
    snoozes.map((snooze) => [snooze.agentActionId, snooze])
  )

  const queue = {
    notQueued: 0,
    pending: 0,
    inFlight: 0,
    done: 0,
    failed: 0,
  }

  for (const communication of communications) {
    if (!communication.scrubQueue) {
      queue.notQueued += hasScrub(communication.metadata) ? 0 : 1
      continue
    }
    if (communication.scrubQueue.status === "pending") queue.pending += 1
    if (communication.scrubQueue.status === "in_flight") queue.inFlight += 1
    if (communication.scrubQueue.status === "done") queue.done += 1
    if (communication.scrubQueue.status === "failed") queue.failed += 1
  }

  return {
    entityType,
    entityId,
    surface,
    queue,
    scrubbedCommunications: communications
      .map((communication) => {
        const scrub = getScrub(communication.metadata)
        if (!scrub) return null
        return {
          communicationId: communication.id,
          subject: communication.subject,
          date: communication.date.toISOString(),
          summary: stringOrNull(scrub.summary),
          urgency: stringOrNull(scrub.urgency),
          replyRequired:
            typeof scrub.replyRequired === "boolean"
              ? scrub.replyRequired
              : null,
          topicTags: Array.isArray(scrub.topicTags)
            ? scrub.topicTags.filter(
                (tag): tag is string => typeof tag === "string"
              )
            : [],
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
    actions: actions.map((action) => {
      const snooze = snoozeByAction.get(action.id)
      const scrub = getScrub(action.sourceCommunication?.metadata)
      const staleReason = getStaleReason(action)
      const { contacts, deals, hasMore } = linkedCandidateChips(scrub)
      return {
        id: action.id,
        actionType: action.actionType,
        status: action.status,
        tier: action.tier,
        summary: action.summary,
        payload: action.payload,
        sourceCommunicationId: action.sourceCommunicationId,
        targetEntity: action.targetEntity,
        evidence: action.sourceCommunication
          ? {
              subject: action.sourceCommunication.subject,
              date: action.sourceCommunication.date.toISOString(),
              summary: stringOrNull(scrub?.summary),
              outlookUrl: action.sourceCommunication.externalMessageId
                ? `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(
                    action.sourceCommunication.externalMessageId
                  )}`
                : null,
            }
          : null,
        promptVersion: action.promptVersion,
        createdAt: action.createdAt.toISOString(),
        isStale: staleReason !== null,
        staleReason,
        isSnoozed: Boolean(snooze),
        snoozedUntil: snooze?.snoozedUntil?.toISOString() ?? null,
        duplicateOfActionId: action.duplicateOfActionId,
        dedupedToTodoId: action.dedupedToTodoId,
        linkedContactCandidates: contacts,
        linkedDealCandidates: deals,
        hasMoreLinkedCandidates: hasMore,
      }
    }),
  }
}

async function findEntityCommunications(
  entityType: "contact" | "deal" | "communication",
  entityId: string
) {
  if (entityType === "communication") {
    return db.communication.findMany({
      where: { id: entityId },
      orderBy: { date: "desc" },
      take: 1,
      select: communicationSuggestionSelect,
    })
  }
  return db.communication.findMany({
    where:
      entityType === "contact" ? { contactId: entityId } : { dealId: entityId },
    orderBy: { date: "desc" },
    take: 50,
    select: communicationSuggestionSelect,
  })
}

const communicationSuggestionSelect = {
  id: true,
  subject: true,
  date: true,
  metadata: true,
  externalMessageId: true,
  scrubQueue: {
    select: { status: true },
  },
} satisfies Prisma.CommunicationSelect

function getStaleReason(action: {
  sourceCommunication: { archivedAt: Date | null } | null
  actionType: string
  promptVersion: string
}) {
  if (!action.sourceCommunication) return "source_missing"
  if (action.sourceCommunication.archivedAt) return "source_archived"
  if (
    action.promptVersion !== PROMPT_VERSION &&
    (isHighImpact(action.actionType) ||
      Date.now() - new Date(PROMPT_RELEASED_AT).getTime() > 14 * 86400000)
  ) {
    return "old_prompt_version"
  }
  return null
}

function isHighImpact(actionType: string) {
  return [
    "move-deal-stage",
    "update-deal",
    "create-meeting",
    "update-meeting",
  ].includes(actionType)
}

function linkedCandidateChips(scrub: Record<string, unknown> | null): {
  contacts: LinkedCandidateChip[]
  deals: LinkedCandidateChip[]
  hasMore: boolean
} {
  const contacts = candidateArray(
    scrub?.linkedContactCandidates,
    "contactId",
    "contact"
  )
  const deals = candidateArray(scrub?.linkedDealCandidates, "dealId", "deal")
  return {
    contacts: contacts.slice(0, 2),
    deals: deals.slice(0, 2),
    hasMore: contacts.length > 2 || deals.length > 2,
  }
}

function candidateArray(
  value: unknown,
  idKey: string,
  kind: "contact" | "deal"
): LinkedCandidateChip[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item && typeof item === "object" ? item : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      kind,
      id: typeof item[idKey] === "string" ? item[idKey] : "",
      label:
        typeof item.label === "string"
          ? item.label
          : idKey === "contactId"
            ? "Matched contact"
            : "Matched deal",
      confidence:
        typeof item.confidence === "number" ? item.confidence : Number.NaN,
      reason: typeof item.reason === "string" ? item.reason : "",
      matchedVia:
        typeof item.matchedVia === "string" ? item.matchedVia : undefined,
    }))
    .filter((item) => item.id && item.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
}

function hasScrub(metadata: Prisma.JsonValue | null) {
  return getScrub(metadata) !== null
}

function getScrub(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const scrub = (metadata as Record<string, unknown>).scrub
  if (!scrub || typeof scrub !== "object" || Array.isArray(scrub)) return null
  return scrub as Record<string, unknown>
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null
}
