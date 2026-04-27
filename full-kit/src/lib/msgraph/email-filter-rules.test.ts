import { describe, expect, it } from "vitest"

import {
  SEEDED_EMAIL_FILTER_RULES,
  assertUniqueEmailFilterRules,
  createRuleVersionSnapshot,
  findSeededEmailFilterRule,
} from "./email-filter-rules"

describe("email filter rule registry", () => {
  it("has unique rule/version pairs", () => {
    expect(() => assertUniqueEmailFilterRules()).not.toThrow()
  })

  it("keeps current skip-capable rules out of active safe-skip mode by default", () => {
    const skipCapable = SEEDED_EMAIL_FILTER_RULES.filter(
      (rule) => rule.safeSkipCapable
    )
    expect(skipCapable.length).toBeGreaterThan(0)
    expect(skipCapable.every((rule) => rule.rolloutPercent === 0)).toBe(true)
    expect(skipCapable.some((rule) => rule.mode === "active")).toBe(false)
  })

  it("pins rule modes and versions in a snapshot", () => {
    const snapshot = createRuleVersionSnapshot()
    expect(snapshot["layer-b-unsubscribe-header"]).toMatchObject({
      version: 1,
      mode: "quarantine_candidate",
      enabled: true,
    })
  })

  it("falls back to classification safety default for unknown rule ids", () => {
    expect(findSeededEmailFilterRule("missing").ruleId).toBe(
      "classification-safety-default"
    )
  })
})
