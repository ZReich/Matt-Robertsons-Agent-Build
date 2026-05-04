/**
 * Display metadata for ContactProfileFact categories.
 *
 * Two axes:
 * - `group` splits categories into "personal" (relationship-building texture
 *   surfaced in the Personal tab) vs "workflow" (transactional / scheduling
 *   facts surfaced in the Overview tab's Relationship Profile card).
 * - `label` is the human-readable string we show in the UI (Title Case,
 *   space-separated). Falling back to `formatProfileCategoryFallback` for
 *   any future enum value we forget to add here keeps the UI from breaking
 *   when the prompt ships a new bucket.
 *
 * Source of truth for the enum values themselves is
 * `src/lib/ai/scrub-types.ts` — keep this map aligned when categories
 * change there.
 */

export type ProfileFactGroup = "personal" | "workflow"

export type ProfileFactCategoryMeta = {
  label: string
  group: ProfileFactGroup
  /** Short helper line shown under the group heading on the Personal tab. */
  hint?: string
}

const CATEGORY_META: Record<string, ProfileFactCategoryMeta> = {
  // Workflow / transactional buckets (RALPLAN Phase 5).
  preference: { label: "Preferences", group: "workflow" },
  communication_style: { label: "Communication Style", group: "workflow" },
  schedule_constraint: { label: "Schedule Constraints", group: "workflow" },
  deal_interest: { label: "Deal Interests", group: "workflow" },
  objection: { label: "Objections", group: "workflow" },
  important_date: { label: "Important Dates", group: "workflow" },

  // Personal / relationship-building buckets (added prompt v6).
  family: {
    label: "Family",
    group: "personal",
    hint: "Spouse, kids, parents, siblings",
  },
  pets: {
    label: "Pets",
    group: "personal",
    hint: "Dogs, cats, animals at home",
  },
  hobbies: {
    label: "Hobbies & Activities",
    group: "personal",
    hint: "What they do for fun",
  },
  vehicles: {
    label: "Vehicles",
    group: "personal",
    hint: "Cars, trucks, boats, planes",
  },
  sports: {
    label: "Sports & Teams",
    group: "personal",
    hint: "Teams they follow, sports they play",
  },
  travel: {
    label: "Travel",
    group: "personal",
    hint: "Trips, vacations, hometown",
  },
  food: {
    label: "Food & Restaurants",
    group: "personal",
    hint: "Favorite spots, dietary notes",
  },
  personal_milestone: {
    label: "Milestones",
    group: "personal",
    hint: "Birthdays, anniversaries, big life events",
  },
}

export function getProfileFactMeta(category: string): ProfileFactCategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      label: formatProfileCategoryFallback(category),
      group: "workflow",
    }
  )
}

export function isPersonalCategory(category: string): boolean {
  return getProfileFactMeta(category).group === "personal"
}

export function isWorkflowCategory(category: string): boolean {
  return getProfileFactMeta(category).group === "workflow"
}

/**
 * Order in which personal-tab category cards render. Anything not in this
 * list (forgotten enum, future addition) appears at the end in its own
 * card so we never silently drop a fact.
 */
export const PERSONAL_CATEGORY_RENDER_ORDER = [
  "family",
  "pets",
  "personal_milestone",
  "hobbies",
  "sports",
  "vehicles",
  "travel",
  "food",
] as const

export function formatProfileCategoryFallback(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export type GroupedFacts<T> = {
  personal: Array<{
    category: string
    meta: ProfileFactCategoryMeta
    facts: T[]
  }>
  workflow: Array<{
    category: string
    meta: ProfileFactCategoryMeta
    facts: T[]
  }>
}

/**
 * Group a flat list of facts by category, producing two ordered lists
 * (personal, workflow). Personal categories follow PERSONAL_CATEGORY_RENDER_ORDER
 * with unknown personal categories appended; workflow categories follow
 * insertion order from the input.
 */
export function groupFactsByDisplayCategory<T extends { category: string }>(
  facts: T[]
): GroupedFacts<T> {
  const buckets = new Map<string, T[]>()
  for (const fact of facts) {
    const key = fact.category || "other"
    const existing = buckets.get(key)
    if (existing) {
      existing.push(fact)
    } else {
      buckets.set(key, [fact])
    }
  }

  const personal: GroupedFacts<T>["personal"] = []
  const workflow: GroupedFacts<T>["workflow"] = []
  const seenPersonal = new Set<string>()

  for (const category of PERSONAL_CATEGORY_RENDER_ORDER) {
    const factList = buckets.get(category)
    if (!factList || factList.length === 0) continue
    personal.push({
      category,
      meta: getProfileFactMeta(category),
      facts: factList,
    })
    seenPersonal.add(category)
  }

  for (const [category, factList] of buckets) {
    if (seenPersonal.has(category)) continue
    const meta = getProfileFactMeta(category)
    if (meta.group === "personal") {
      personal.push({ category, meta, facts: factList })
    } else {
      workflow.push({ category, meta, facts: factList })
    }
  }

  return { personal, workflow }
}
