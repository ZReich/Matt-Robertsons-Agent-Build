export type BackfillMode = "lifetime" | "deal-anchored"

export interface DealAnchor {
  createdAt: Date
  closedAt: Date | null
}

export interface CommAnchor {
  date: Date
}

export interface ResolveInput {
  mode: BackfillMode
  deals: DealAnchor[]
  comms: CommAnchor[]
  now: Date
}

export interface BackfillWindow {
  start: Date
  end: Date
  source: "lifetime" | "deal" | "comm"
}

const FAR_PAST = new Date("1970-01-01T00:00:00Z")

// Calendar-correct ±24-month shift (handles leap years / variable month lengths).
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime())
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

export function resolveBackfillWindows(input: ResolveInput): BackfillWindow[] {
  if (input.mode === "lifetime") {
    return [{ start: FAR_PAST, end: input.now, source: "lifetime" }]
  }

  // deal-anchored
  const raw: BackfillWindow[] = []

  for (const d of input.deals) {
    const start = addMonths(d.createdAt, -24)
    const endAnchor = d.closedAt ?? input.now
    const end = addMonths(endAnchor, 24)
    raw.push({ start, end, source: "deal" })
  }

  if (raw.length === 0 && input.comms.length > 0) {
    const dates = input.comms.map((c) => c.date.getTime())
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    raw.push({
      start: addMonths(new Date(min), -24),
      end: addMonths(new Date(max), 24),
      source: "comm",
    })
  }

  if (raw.length === 0) return []

  // Union overlapping windows
  raw.sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: BackfillWindow[] = [raw[0]]
  for (let i = 1; i < raw.length; i++) {
    const last = merged[merged.length - 1]
    const next = raw[i]
    if (next.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), next.end.getTime()))
    } else {
      merged.push(next)
    }
  }

  // Clamp each window to 8 calendar years.
  // Compute via calendar shift so leap-year padding doesn't trigger clamping
  // for windows that are exactly 8 calendar years wide.
  return merged.map((w) => {
    const eightYearsBeforeEnd = addMonths(w.end, -96)
    if (w.start.getTime() >= eightYearsBeforeEnd.getTime()) return w
    return { ...w, start: eightYearsBeforeEnd }
  })
}
