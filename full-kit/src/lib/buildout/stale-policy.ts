export const STALE_DEAL_DEFAULTS = {
  activeDealDays: 14,
  waitingOnOtherDays: 7,
  hotLeadBusinessDays: 1,
} as const

export type DealActivityClocks = {
  lastMattTouchAt?: Date | null
  lastCounterpartyTouchAt?: Date | null
  lastBuildoutEventAt?: Date | null
  lastExternalEngagementAt?: Date | null
  lastStageChangeAt?: Date | null
  nextReminderAt?: Date | null
  stage?: string | null
}

export type StaleDealDecision = {
  stale: boolean
  reason: string
  thresholdDays?: number
  since?: Date
}

export function evaluateStaleDeal(
  clocks: DealActivityClocks,
  now = new Date()
): StaleDealDecision {
  if (clocks.stage === "closed" || clocks.stage === "dead") {
    return { stale: false, reason: "inactive-stage" }
  }

  if (clocks.nextReminderAt && clocks.nextReminderAt <= now) {
    return { stale: true, reason: "reminder-due", since: clocks.nextReminderAt }
  }
  if (clocks.nextReminderAt && clocks.nextReminderAt > now) {
    return {
      stale: false,
      reason: "reminder-scheduled",
      since: clocks.nextReminderAt,
    }
  }

  const latestMeaningful = maxDate([
    clocks.lastMattTouchAt,
    clocks.lastCounterpartyTouchAt,
    clocks.lastBuildoutEventAt,
    clocks.lastExternalEngagementAt,
    clocks.lastStageChangeAt,
  ])
  if (!latestMeaningful) return { stale: true, reason: "no-activity-recorded" }

  const days = daysBetween(latestMeaningful, now)
  if (days >= STALE_DEAL_DEFAULTS.activeDealDays) {
    return {
      stale: true,
      reason: "active-deal-no-meaningful-activity",
      thresholdDays: STALE_DEAL_DEFAULTS.activeDealDays,
      since: latestMeaningful,
    }
  }

  return {
    stale: false,
    reason: "recent-meaningful-activity",
    since: latestMeaningful,
  }
}

export function evaluateWaitingOnOther(
  lastMattTouchAt: Date | null | undefined,
  lastCounterpartyTouchAt: Date | null | undefined,
  now = new Date()
): StaleDealDecision {
  if (!lastMattTouchAt) return { stale: false, reason: "no-matt-touch" }
  if (lastCounterpartyTouchAt && lastCounterpartyTouchAt > lastMattTouchAt) {
    return {
      stale: false,
      reason: "counterparty-responded",
      since: lastCounterpartyTouchAt,
    }
  }
  const days = daysBetween(lastMattTouchAt, now)
  return days >= STALE_DEAL_DEFAULTS.waitingOnOtherDays
    ? {
        stale: true,
        reason: "waiting-on-other-threshold-exceeded",
        thresholdDays: STALE_DEAL_DEFAULTS.waitingOnOtherDays,
        since: lastMattTouchAt,
      }
    : {
        stale: false,
        reason: "waiting-on-other-within-threshold",
        since: lastMattTouchAt,
      }
}

function maxDate(dates: Array<Date | null | undefined>): Date | null {
  const values = dates.filter((date): date is Date => date instanceof Date)
  if (values.length === 0) return null
  return new Date(Math.max(...values.map((date) => date.getTime())))
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}
