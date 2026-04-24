import { z } from "zod"

import type { SuggestedAction, ValidatedScrubResult } from "./scrub-types"

import {
  DEAL_STAGES,
  MEMORY_TYPES,
  PRIORITIES,
  SENTIMENTS,
  TOPIC_TAGS,
  URGENCIES,
} from "./scrub-types"

/**
 * Discriminates validation failures so the orchestrator can decide whether
 * to trigger a correction retry (outer-shape) vs mark the row failed
 * immediately (per-action in strict mode).
 */
export class ScrubValidationError extends Error {
  code = "SCRUB_VALIDATION_ERROR" as const

  constructor(
    readonly kind: "outer-shape" | "per-action",
    message: string,
    readonly droppedActions: Array<{
      index: number
      actionType: string
      reason: string
    }> = []
  ) {
    super(message)
  }
}

const prioritySchema = z.enum(PRIORITIES)

const payloadSchemas = {
  "create-todo": z.object({
    title: z.string().min(1),
    body: z.string().optional(),
    priority: prioritySchema,
    dueHint: z.string().optional(),
    parsedDueDate: z.string().datetime().optional(),
    contactId: z.string().optional(),
    dealId: z.string().optional(),
  }),
  "move-deal-stage": z.object({
    dealId: z.string().min(1),
    fromStage: z.enum(DEAL_STAGES),
    toStage: z.enum(DEAL_STAGES),
    reason: z.string().min(1),
  }),
  "update-deal": z.object({
    dealId: z.string().min(1),
    fields: z
      .object({
        value: z.number().optional(),
        closingDate: z.string().datetime().optional(),
        squareFeet: z.number().optional(),
        propertyAddress: z.string().optional(),
      })
      .refine((fields) => Object.keys(fields).length > 0, {
        message: "at least one field is required",
      }),
    reason: z.string().min(1),
  }),
  "create-meeting": z.object({
    title: z.string().min(1),
    date: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    location: z.string().optional(),
    attendeeContactIds: z.array(z.string()).default([]),
    dealId: z.string().optional(),
    reason: z.string().min(1),
  }),
  "update-meeting": z.object({
    meetingId: z.string().min(1),
    fields: z
      .object({
        date: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        location: z.string().optional(),
        title: z.string().optional(),
      })
      .refine((fields) => Object.keys(fields).length > 0, {
        message: "at least one field is required",
      }),
    reason: z.string().min(1),
  }),
  "create-agent-memory": z.object({
    memoryType: z.enum(MEMORY_TYPES),
    title: z.string().min(1),
    content: z.string().min(1),
    contactId: z.string().optional(),
    dealId: z.string().optional(),
    priority: prioritySchema.optional(),
  }),
} satisfies Record<string, z.ZodTypeAny>

const topLevelSchema = z.object({
  summary: z.string().min(1).max(400),
  topicTags: z.array(z.enum(TOPIC_TAGS)).max(4),
  urgency: z.enum(URGENCIES),
  replyRequired: z.boolean(),
  sentiment: z.union([z.enum(SENTIMENTS), z.null()]),
  linkedContactCandidates: z.array(
    z.object({
      contactId: z.string().min(1),
      confidence: z.number().min(0).max(1),
      reason: z.string().min(1),
    })
  ),
  linkedDealCandidates: z.array(
    z.object({
      dealId: z.string().min(1),
      confidence: z.number().min(0).max(1),
      reason: z.string().min(1),
      matchedVia: z.enum([
        "property_address",
        "property_name",
        "key_contact",
        "subject_match",
      ]),
    })
  ),
  suggestedActions: z
    .array(
      z.object({
        actionType: z.enum([
          "create-todo",
          "move-deal-stage",
          "update-deal",
          "create-meeting",
          "update-meeting",
          "create-agent-memory",
        ]),
        summary: z.string().min(1).max(200),
        payload: z.record(z.unknown()),
      })
    )
    .max(5),
})

export function validateScrubToolInput(
  input: unknown,
  opts: { mode: "strict" | "relaxed" } = { mode: "strict" }
): ValidatedScrubResult {
  const outer = topLevelSchema.safeParse(input)
  if (!outer.success) {
    throw new ScrubValidationError(
      "outer-shape",
      outer.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")
    )
  }
  const parsed = outer.data

  const good: SuggestedAction[] = []
  const dropped: Array<{ index: number; actionType: string; reason: string }> =
    []

  for (let i = 0; i < parsed.suggestedActions.length; i += 1) {
    const action = parsed.suggestedActions[i]
    const result = payloadSchemas[action.actionType].safeParse(action.payload)
    if (result.success) {
      good.push({
        actionType: action.actionType,
        summary: action.summary,
        payload: result.data,
      })
    } else {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
      dropped.push({ index: i, actionType: action.actionType, reason })
      if (opts.mode === "strict") {
        throw new ScrubValidationError(
          "per-action",
          `action[${i}] ${action.actionType}: ${reason}`,
          dropped
        )
      }
      // relaxed mode — record + continue
    }
  }

  if (dropped.length > 0) {
    console.warn(
      `[scrub] dropped ${dropped.length} action(s) (relaxed mode):`,
      dropped
    )
  }

  return {
    scrubOutput: {
      summary: parsed.summary,
      topicTags: parsed.topicTags,
      urgency: parsed.urgency,
      replyRequired: parsed.replyRequired,
      sentiment: parsed.sentiment,
      linkedContactCandidates: parsed.linkedContactCandidates,
      linkedDealCandidates: parsed.linkedDealCandidates,
    },
    suggestedActions: good,
    droppedActions: dropped.length,
  }
}
