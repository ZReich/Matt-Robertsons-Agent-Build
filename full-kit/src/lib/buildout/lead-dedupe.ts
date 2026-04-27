import { normalizeBuildoutProperty } from "./property-normalizer"

export type BuildoutLeadLike = {
  id: string
  subject: string
  body?: string
  receivedAt: Date
  kind: "new-lead" | "information-requested"
  propertyName?: string
  inquirerName?: string
  inquirerEmail?: string
}

export type BuildoutLeadDedupeGroup = {
  dedupeKey: string
  primary: BuildoutLeadLike
  evidence: BuildoutLeadLike[]
  suppressed: BuildoutLeadLike[]
}

const TEN_MINUTES_MS = 10 * 60 * 1000

export function buildBuildoutLeadDedupeKey(event: BuildoutLeadLike): string {
  const normalized = normalizeBuildoutProperty(event.propertyName, event.body)
  const propertyKey = normalized?.normalizedPropertyKey ?? "unknown-property"
  const identity =
    knownIdentity(event.inquirerEmail ?? event.inquirerName) ??
    `unknown:${event.id}`
  const bucket = Math.floor(event.receivedAt.getTime() / TEN_MINUTES_MS)
  return `buildout-lead:${propertyKey}:${identity}:${bucket}`
}

export function dedupeBuildoutLeadEvents(
  events: BuildoutLeadLike[]
): BuildoutLeadDedupeGroup[] {
  const groups: BuildoutLeadDedupeGroup[] = []
  const consumed = new Set<string>()
  const sorted = [...events].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
  )

  for (const event of sorted) {
    if (consumed.has(event.id)) continue
    const paired = sorted.filter(
      (candidate) =>
        !consumed.has(candidate.id) &&
        (candidate.id === event.id || isSameLeadPair(event, candidate)) &&
        Math.abs(candidate.receivedAt.getTime() - event.receivedAt.getTime()) <=
          TEN_MINUTES_MS
    )
    const primary = choosePrimary(paired)
    for (const item of paired) consumed.add(item.id)
    groups.push({
      dedupeKey: buildBuildoutLeadDedupeKey(primary),
      primary,
      evidence: paired,
      suppressed: paired.filter((item) => item.id !== primary.id),
    })
  }

  return groups
}

function choosePrimary(events: BuildoutLeadLike[]): BuildoutLeadLike {
  return (
    events.find((event) => event.kind === "new-lead") ??
    events.find((event) => event.inquirerEmail) ??
    events[0]
  )
}

function isSameLeadPair(a: BuildoutLeadLike, b: BuildoutLeadLike): boolean {
  const aProperty = normalizeBuildoutProperty(a.propertyName, a.body)
  const bProperty = normalizeBuildoutProperty(b.propertyName, b.body)
  const propertyMatches =
    !!aProperty?.normalizedPropertyKey &&
    aProperty.normalizedPropertyKey === bProperty?.normalizedPropertyKey
  const aIdentity = knownIdentity(a.inquirerEmail ?? a.inquirerName)
  const bIdentity = knownIdentity(b.inquirerEmail ?? b.inquirerName)
  const identityMatches = !!aIdentity && aIdentity === bIdentity
  return propertyMatches && identityMatches
}

function knownIdentity(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return normalized || null
}
