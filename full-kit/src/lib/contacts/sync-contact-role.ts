import type { ClientType, Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

import { nextClientType } from "./role-lifecycle"

export type SyncContactRoleOptions = {
  /** What user-visible event triggered this resync (audit log only). */
  trigger?: "deal_close" | "deal_stage_change" | "deal_created" | "manual_sync"
  /** Deal whose change motivated this resync, if any (audit log only). */
  dealId?: string | null
  /** Source AgentAction (e.g. AI-proposed stage change) that drove this. */
  sourceAgentActionId?: string | null
  /** Originating communication, if known (audit log only). */
  sourceCommunicationId?: string | null
}

export type SyncContactRoleResult = {
  contactId: string
  fromClientType: ClientType | null
  toClientType: ClientType | null
  changed: boolean
  /** Set when `changed` is true. */
  actionId: string | null
}

/**
 * Recompute Contact.clientType from the contact's full deal history and
 * persist any change. When the role actually changes, also write an
 * `AgentAction` audit row with `actionType = "set-client-type"`.
 *
 * Idempotent: re-running with no underlying state change is a no-op (no
 * write, no AgentAction). Safe to call from any path that mutates a deal —
 * PATCH, AI agent-action approval, scripts, backfills.
 *
 * Pass a Prisma TransactionClient as `tx` to participate in the caller's
 * transaction; otherwise the top-level prisma client is used.
 */
export async function syncContactRoleFromDeals(
  contactId: string,
  options: SyncContactRoleOptions = {},
  tx: Prisma.TransactionClient | typeof db = db
): Promise<SyncContactRoleResult> {
  const contact = await tx.contact.findUnique({
    where: { id: contactId },
    select: { id: true, name: true, clientType: true, archivedAt: true },
  })
  if (!contact) {
    return {
      contactId,
      fromClientType: null,
      toClientType: null,
      changed: false,
      actionId: null,
    }
  }
  // Don't touch archived contacts.
  if (contact.archivedAt) {
    return {
      contactId,
      fromClientType: contact.clientType,
      toClientType: contact.clientType,
      changed: false,
      actionId: null,
    }
  }

  const deals = await tx.deal.findMany({
    where: { contactId, archivedAt: null },
    select: {
      id: true,
      dealType: true,
      stage: true,
      outcome: true,
      closedAt: true,
    },
  })

  const nextRole = nextClientType(deals)
  const prev = contact.clientType
  if (nextRole === prev) {
    return {
      contactId,
      fromClientType: prev,
      toClientType: prev,
      changed: false,
      actionId: null,
    }
  }

  await tx.contact.update({
    where: { id: contactId },
    data: { clientType: nextRole },
  })

  const action = await tx.agentAction.create({
    data: {
      actionType: "set-client-type",
      tier: "auto",
      status: "executed",
      executedAt: new Date(),
      summary: `Set ${contact.name} clientType ${prev ?? "null"} → ${
        nextRole ?? "null"
      }${options.trigger ? ` (${options.trigger})` : ""}`,
      targetEntity: `contact:${contact.id}`,
      sourceCommunicationId: options.sourceCommunicationId ?? null,
      duplicateOfActionId: options.sourceAgentActionId ?? null,
      payload: {
        contactId: contact.id,
        fromClientType: prev,
        toClientType: nextRole,
        dealId: options.dealId ?? null,
        trigger: options.trigger ?? "manual_sync",
        sourceAgentActionId: options.sourceAgentActionId ?? null,
      },
      promptVersion: "deterministic",
    },
    select: { id: true },
  })

  return {
    contactId,
    fromClientType: prev,
    toClientType: nextRole,
    changed: true,
    actionId: action.id,
  }
}

// computeRole was inlined into the pure helper `nextClientType`
// (./role-lifecycle.ts) so the same logic powers route handlers, AI
// agent-action approvals, and the backfill script without duplication.
