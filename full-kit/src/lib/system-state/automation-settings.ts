import "server-only"

import { Prisma } from "@prisma/client"

import { db } from "@/lib/prisma"

const KEY = "app.automation_settings"

export interface AutomationSettings {
  /** When true, an inbound platform-lead inquiry that resolves to a Property
   * in the catalog auto-generates AND auto-sends a draft reply via Graph
   * (instead of queueing it as a Pending Reply). False is the safe default. */
  autoSendNewLeadReplies: boolean

  /** When true, the Daily Listings email triggers per-contact draft replies
   * for ≥80% matches and auto-sends them. False = drafts go to the queue
   * for manual review. */
  autoSendDailyMatchReplies: boolean

  /** Threshold (0–100) above which a property/criteria match auto-creates
   * a PendingReply. Below this, the match is logged but no draft is built. */
  autoMatchScoreThreshold: number

  /** Cap on auto-sent daily-listing replies per Contact per day, to avoid
   * spamming someone whose criteria matches many new listings. */
  dailyMatchPerContactCap: number

  /** Months ahead of `LeaseRecord.leaseEndDate` to start the renewal-alert
   * sweep. Default 6. Range 1-24. */
  leaseRenewalLookaheadMonths: number

  /** When true, the daily lease-renewal sweep auto-sends drafted re-engagement
   * emails via Graph instead of queueing them as Pending Replies. Defaults
   * false — this is past-client outreach and Matt should review the first
   * batch by hand before opting in. Distinct from `autoSendDailyMatchReplies`
   * because the audiences and risk profiles are different (current prospects
   * vs. past clients with sensitive history). */
  autoSendLeaseRenewalReplies: boolean
}

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  autoSendNewLeadReplies: false,
  autoSendDailyMatchReplies: false,
  autoMatchScoreThreshold: 80,
  dailyMatchPerContactCap: 2,
  leaseRenewalLookaheadMonths: 6,
  autoSendLeaseRenewalReplies: false,
}

function isFiniteInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
}

function coerce(value: unknown): AutomationSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_AUTOMATION_SETTINGS
  }
  const v = value as Record<string, unknown>
  return {
    autoSendNewLeadReplies:
      typeof v.autoSendNewLeadReplies === "boolean"
        ? v.autoSendNewLeadReplies
        : DEFAULT_AUTOMATION_SETTINGS.autoSendNewLeadReplies,
    autoSendDailyMatchReplies:
      typeof v.autoSendDailyMatchReplies === "boolean"
        ? v.autoSendDailyMatchReplies
        : DEFAULT_AUTOMATION_SETTINGS.autoSendDailyMatchReplies,
    autoMatchScoreThreshold: isFiniteInRange(v.autoMatchScoreThreshold, 50, 100)
      ? Math.round(v.autoMatchScoreThreshold)
      : DEFAULT_AUTOMATION_SETTINGS.autoMatchScoreThreshold,
    dailyMatchPerContactCap: isFiniteInRange(v.dailyMatchPerContactCap, 1, 20)
      ? Math.round(v.dailyMatchPerContactCap)
      : DEFAULT_AUTOMATION_SETTINGS.dailyMatchPerContactCap,
    leaseRenewalLookaheadMonths: isFiniteInRange(
      v.leaseRenewalLookaheadMonths,
      1,
      24
    )
      ? Math.round(v.leaseRenewalLookaheadMonths)
      : DEFAULT_AUTOMATION_SETTINGS.leaseRenewalLookaheadMonths,
    autoSendLeaseRenewalReplies:
      typeof v.autoSendLeaseRenewalReplies === "boolean"
        ? v.autoSendLeaseRenewalReplies
        : DEFAULT_AUTOMATION_SETTINGS.autoSendLeaseRenewalReplies,
  }
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const row = await db.systemState.findUnique({ where: { key: KEY } })
  return coerce(row?.value)
}

export async function setAutomationSettings(
  patch: Partial<AutomationSettings>
): Promise<AutomationSettings> {
  const current = await getAutomationSettings()
  const next: AutomationSettings = coerce({ ...current, ...patch })
  await db.systemState.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next as unknown as Prisma.InputJsonValue },
    update: { value: next as unknown as Prisma.InputJsonValue },
  })
  return next
}
