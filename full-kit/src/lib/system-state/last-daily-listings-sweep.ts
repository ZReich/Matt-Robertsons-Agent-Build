import "server-only"

import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

const KEY = "app.last_daily_listings_sweep"

export interface LastDailyListingsSweep {
  /** ISO timestamp the sweep finished. */
  ranAt: string
  /** Communications considered (matched the subject filter inside the lookback). */
  candidates: number
  /** Communications actually processed (the unprocessed subset). */
  processed: number
  /** Total listings parsed across all processed emails. */
  listingsParsed: number
  /** PendingReply rows created. */
  draftsCreated: number
  /** Drafts that were auto-sent (only non-zero when autoSendDailyMatchReplies is on). */
  draftsSent: number
  /** Per-email errors aggregated across the sweep. */
  errors: number
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function coerce(value: unknown): LastDailyListingsSweep | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.ranAt !== "string" || v.ranAt.length === 0) return null
  return {
    ranAt: v.ranAt,
    candidates: toNumber(v.candidates),
    processed: toNumber(v.processed),
    listingsParsed: toNumber(v.listingsParsed),
    draftsCreated: toNumber(v.draftsCreated),
    draftsSent: toNumber(v.draftsSent),
    errors: toNumber(v.errors),
  }
}

export async function getLastDailyListingsSweep(): Promise<LastDailyListingsSweep | null> {
  const row = await db.systemState.findUnique({ where: { key: KEY } })
  return coerce(row?.value)
}

export async function setLastDailyListingsSweep(
  summary: LastDailyListingsSweep
): Promise<LastDailyListingsSweep> {
  await db.systemState.upsert({
    where: { key: KEY },
    create: { key: KEY, value: summary as unknown as Prisma.InputJsonValue },
    update: { value: summary as unknown as Prisma.InputJsonValue },
  })
  return summary
}
