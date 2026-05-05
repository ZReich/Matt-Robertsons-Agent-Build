import type { AgentAction, Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"
import { matchEntitiesForAction } from "@/lib/todos/entity-matcher"

/**
 * Agent-action auto-promotion sweep.
 *
 * Goal: collapse the Agent Queue + Todos surfaces into one. Pending
 * AgentAction rows that are still fresh become Todos automatically (with
 * inline approve/reject buttons rendered from `metadata.actionType` for
 * approval-style actions). Pending rows older than the freshness window
 * are marked `expired` so the queue self-prunes without losing the audit
 * trail.
 *
 * The existing `create-todo` / `mark-todo-done` / `create-agent-memory`
 * auto-approval path (see `AUTO_APPROVE_ACTION_TYPES`) is unchanged — we
 * deliberately skip those here so we don't fight it. This sweep only
 * touches action types that previously sat in the Agent Queue waiting
 * for human review.
 *
 * Behavior is policy-driven by `ACTION_TYPE_TODO_BEHAVIOR`:
 *   - "skip"          — leave alone (cache or already-handled actions)
 *   - "auto-todo"     — create a Todo + transition the action to
 *                       `approved` (operator already sees the Todo, so
 *                       the queue row is no longer needed)
 *   - "approval-todo" — create a Todo with rich body + metadata for
 *                       inline approval; LEAVE the AgentAction in
 *                       `pending` so the eventual approve/reject inline
 *                       button can run the existing handler
 */

export interface AutoPromoteResult {
  scanned: number
  promoted: number
  expired: number
  skipped: number
  errors: Array<{ agentActionId: string; error: string }>
}

export interface AutoPromoteOptions {
  freshnessWindowDays?: number
  dryRun?: boolean
  /** Cap on actions processed per sweep; default 500 to bound cron runtime. */
  limit?: number
  /** Override `now` for tests. */
  now?: Date
}

const DEFAULT_FRESHNESS_DAYS = 30
const DEFAULT_LIMIT = 500

/**
 * Per-action-type policy. Anything not listed is treated as "skip" with a
 * console warning — safe default so a brand-new action type doesn't cause
 * surprise side effects.
 *
 * - `create-todo`, `mark-todo-done`, `create-agent-memory` — already
 *   handled by AUTO_APPROVE_ACTION_TYPES at scrub-applier time, no work
 *   needed here.
 * - `summarize-thread`, `summarize-contact` — pure cache writes, never
 *   surface to the operator.
 * - `set-client-type` — auto-todo; the operator should see "Mark Acme
 *   as past_client" so they can confirm the lifecycle change.
 * - `move-deal-stage`, `update-deal`, `create-deal` — high-impact pipeline
 *   changes. Surface as approval-todo with inline Apply / Reject.
 * - `update-meeting` — same pattern; calendar edits need confirmation.
 * - `auto-reply`, `delete-contact`, `delete-property`, `delete-deal` —
 *   approval-todo with inline buttons (see Todos UI).
 */
export const ACTION_TYPE_TODO_BEHAVIOR: Record<
  string,
  "auto-todo" | "approval-todo" | "skip"
> = {
  // Already handled by AUTO_APPROVE_ACTION_TYPES; nothing to do.
  "create-todo": "skip",
  "mark-todo-done": "skip",
  "create-agent-memory": "skip",
  // Pure cache actions — no operator surface required.
  "summarize-thread": "skip",
  "summarize-contact": "skip",
  // Lifecycle nudges where the operator should glance + confirm.
  "set-client-type": "auto-todo",
  // Pipeline changes the operator must approve.
  "move-deal-stage": "approval-todo",
  "update-deal": "approval-todo",
  "create-deal": "approval-todo",
  "update-meeting": "approval-todo",
  // Outbound + destructive actions: explicit human gate.
  "auto-reply": "approval-todo",
  "delete-contact": "approval-todo",
  "delete-property": "approval-todo",
  "delete-deal": "approval-todo",
}

export async function autoPromoteAgentActionsToTodos(
  opts: AutoPromoteOptions = {}
): Promise<AutoPromoteResult> {
  const freshnessDays = opts.freshnessWindowDays ?? DEFAULT_FRESHNESS_DAYS
  const limit = opts.limit ?? DEFAULT_LIMIT
  const dryRun = opts.dryRun === true
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - freshnessDays * 24 * 60 * 60 * 1000)

  const pending = await db.agentAction.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      sourceCommunication: {
        select: {
          id: true,
          subject: true,
          body: true,
          date: true,
          contactId: true,
          dealId: true,
          contact: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  const result: AutoPromoteResult = {
    scanned: pending.length,
    promoted: 0,
    expired: 0,
    skipped: 0,
    errors: [],
  }

  for (const action of pending) {
    try {
      // Stale → expired. Process this BEFORE the policy lookup so a
      // long-pending unsupported action still gets retired.
      if (action.createdAt < cutoff) {
        if (!dryRun) {
          await db.agentAction.update({
            where: { id: action.id },
            data: { status: "expired", feedback: "auto-expired-by-sweep" },
          })
        }
        result.expired++
        continue
      }

      const policy = ACTION_TYPE_TODO_BEHAVIOR[action.actionType] ?? null
      if (policy === null) {
        console.warn(
          `[auto-promote] unknown actionType=${action.actionType} (action ${action.id}); skipping. Add it to ACTION_TYPE_TODO_BEHAVIOR.`
        )
        result.skipped++
        continue
      }

      if (policy === "skip") {
        result.skipped++
        continue
      }

      if (dryRun) {
        result.promoted++
        continue
      }

      const promoted = await createTodoForApprovableAction(action, policy)
      if (promoted) result.promoted++
      else result.skipped++
    } catch (err) {
      result.errors.push({
        agentActionId: action.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

type PendingActionWithComm = AgentAction & {
  sourceCommunication: {
    id: string
    subject: string | null
    body: string | null
    date: Date
    contactId: string | null
    dealId: string | null
    contact: { id: string; name: string; email: string | null } | null
  } | null
}

/**
 * Build a context-rich Todo for an approvable agent action and link the
 * action to it. The AgentAction is left in `pending` for "approval-todo"
 * so the inline button on the Todo can run the existing approve handler;
 * for "auto-todo" the action is moved to `approved` (operator sees the
 * Todo, no further side effect needed).
 *
 * Returns true when a new Todo was created, false on a soft-skip
 * (e.g. the action already produced a Todo via the existing dedupe path).
 */
export async function createTodoForApprovableAction(
  action: PendingActionWithComm,
  policy: "auto-todo" | "approval-todo"
): Promise<boolean> {
  // Don't double-create — if an earlier sweep already linked this action
  // to a Todo, the existing Todo is the source of truth.
  const existingByAction = await db.todo.findUnique({
    where: { agentActionId: action.id },
    select: { id: true },
  })
  if (existingByAction) return false

  const match = await matchEntitiesForAction({
    agentActionPayload: action.payload,
    sourceCommunicationId: action.sourceCommunicationId,
  })

  // Prefer payload-derived contact/deal IDs when present (the upstream
  // emitter usually has more context than the matcher's heuristics).
  const payload = asRecord(action.payload)
  const payloadContactId = pickString(payload, ["contactId"])
  const payloadDealId = pickString(payload, ["dealId"])
  const contactId =
    payloadContactId ??
    match.contactId ??
    action.sourceCommunication?.contactId ??
    null
  const dealId =
    payloadDealId ??
    match.dealId ??
    action.sourceCommunication?.dealId ??
    null
  const propertyId = match.propertyId

  const title = buildTitle(action)
  const body = buildBody(action, contactId)

  const metadata: Prisma.InputJsonValue = {
    actionType: action.actionType,
    agentActionId: action.id,
    payload: (action.payload ?? {}) as Prisma.InputJsonValue,
    matchScore: match.matchScore,
    matchSignals: match.matchSignals,
    policy,
  }

  const dedupeKey = `auto-promote:${action.id}`

  await db.$transaction(async (tx) => {
    await tx.todo.create({
      data: {
        title,
        body,
        priority: "medium",
        contactId,
        dealId,
        // Property doesn't have a direct FK on Todo today; we surface it
        // via metadata so the UI can render a property chip without a
        // schema change. Future: lift propertyId onto the Todo model.
        communicationId: action.sourceCommunicationId,
        agentActionId: action.id,
        dedupeKey,
        createdBy: "agent-auto-promote",
        metadata,
      },
    })

    // For auto-todo we close the loop on the AgentAction since the
    // operator already sees the Todo. For approval-todo we leave it
    // pending so the inline approve/reject button can drive the
    // existing approveAgentAction / rejectAgentAction flow.
    if (policy === "auto-todo") {
      await tx.agentAction.update({
        where: { id: action.id },
        data: { status: "approved", feedback: "auto-promoted-to-todo" },
      })
    }
    void propertyId // referenced by metadata; suppress unused-var lint
  })

  return true
}

function buildTitle(action: PendingActionWithComm): string {
  const summary = action.summary?.trim()
  switch (action.actionType) {
    case "auto-reply": {
      const subject =
        action.sourceCommunication?.subject ??
        pickString(asRecord(action.payload), ["subject"]) ??
        "(no subject)"
      return `Review draft reply: ${subject}`.slice(0, 250)
    }
    case "delete-contact":
    case "delete-property":
    case "delete-deal": {
      const target =
        pickString(asRecord(action.payload), ["name", "address"]) ??
        action.targetEntity ??
        "(unspecified)"
      const kind = action.actionType.replace("delete-", "")
      return `Confirm delete ${kind}: ${target}`.slice(0, 250)
    }
    case "move-deal-stage": {
      const stage = pickString(asRecord(action.payload), [
        "toStage",
        "newStage",
        "stage",
      ])
      return `Apply stage change${stage ? ` → ${stage}` : ""}: ${summary ?? action.targetEntity ?? ""}`.slice(
        0,
        250
      )
    }
    case "update-deal":
      return `Apply deal update: ${summary ?? action.targetEntity ?? ""}`.slice(
        0,
        250
      )
    case "create-deal":
      return `Confirm new deal: ${summary ?? ""}`.slice(0, 250)
    case "update-meeting":
      return `Confirm meeting change: ${summary ?? ""}`.slice(0, 250)
    case "set-client-type": {
      const type = pickString(asRecord(action.payload), ["clientType"])
      return `Confirm client type${type ? ` = ${type}` : ""}: ${summary ?? ""}`.slice(
        0,
        250
      )
    }
    default:
      return summary ?? `Review agent action: ${action.actionType}`
  }
}

function buildBody(
  action: PendingActionWithComm,
  matchedContactId: string | null
): string {
  const sections: string[] = []
  const summary = action.summary?.trim()

  // 1. Why this matters
  if (summary) {
    sections.push(`**Why this matters**\n\n${summary}`)
  }

  // 2. Source communication context
  const comm = action.sourceCommunication
  if (comm) {
    const lines: string[] = []
    lines.push(`**Source**`)
    lines.push("")
    if (comm.subject) lines.push(`- Subject: ${comm.subject}`)
    lines.push(`- Date: ${comm.date.toISOString().slice(0, 10)}`)
    if (comm.contact?.name) {
      const who = comm.contact.email
        ? `${comm.contact.name} <${comm.contact.email}>`
        : comm.contact.name
      lines.push(`- From: ${who}`)
    }
    if (comm.body) {
      const snippet = comm.body.replace(/\s+/g, " ").trim().slice(0, 200)
      if (snippet) lines.push(`- Excerpt: ${snippet}${comm.body.length > 200 ? "…" : ""}`)
    }
    sections.push(lines.join("\n"))
  }

  // 3. Linked entity context (lightweight — the Todo card already
  //    renders chips for contactId/dealId, so we just note the link in
  //    the body for accessibility / search).
  if (matchedContactId) {
    sections.push(`**Linked contact**: \`${matchedContactId}\``)
  }

  // 4. Proposed action — render the payload as a fenced JSON block
  //    so the operator can audit before approving inline.
  const payload = action.payload
  if (payload && typeof payload === "object") {
    sections.push(
      `**Proposed action**\n\n\`\`\`json\n${JSON.stringify(payload, null, 2).slice(0, 1000)}\n\`\`\``
    )
  }

  // 5. Action type tag (so a code search for an action type still
  //    surfaces the related Todo body).
  sections.push(`_Agent action type: \`${action.actionType}\`_`)

  return sections.join("\n\n")
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function pickString(
  payload: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const v = payload[key]
    if (typeof v === "string" && v.trim().length > 0) return v
  }
  return null
}
