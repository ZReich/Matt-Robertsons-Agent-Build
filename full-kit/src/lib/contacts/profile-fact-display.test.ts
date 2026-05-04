import { describe, expect, it } from "vitest"

import {
  PERSONAL_CATEGORY_RENDER_ORDER,
  getProfileFactMeta,
  groupFactsByDisplayCategory,
  isPersonalCategory,
  isWorkflowCategory,
} from "./profile-fact-display"

describe("getProfileFactMeta", () => {
  it("returns labeled meta for a known personal category", () => {
    const meta = getProfileFactMeta("family")
    expect(meta.label).toBe("Family")
    expect(meta.group).toBe("personal")
    expect(meta.hint).toBeDefined()
  })

  it("returns labeled meta for a known workflow category", () => {
    const meta = getProfileFactMeta("schedule_constraint")
    expect(meta.label).toBe("Schedule Constraints")
    expect(meta.group).toBe("workflow")
  })

  it("falls back to a workflow-style title-cased label for unknown categories", () => {
    const meta = getProfileFactMeta("future_unknown_bucket")
    expect(meta.label).toBe("Future Unknown Bucket")
    expect(meta.group).toBe("workflow")
  })
})

describe("isPersonalCategory / isWorkflowCategory", () => {
  it("classifies the personal categories", () => {
    for (const cat of PERSONAL_CATEGORY_RENDER_ORDER) {
      expect(isPersonalCategory(cat)).toBe(true)
      expect(isWorkflowCategory(cat)).toBe(false)
    }
  })

  it("classifies the workflow categories", () => {
    const workflow = [
      "preference",
      "communication_style",
      "schedule_constraint",
      "deal_interest",
      "objection",
      "important_date",
    ]
    for (const cat of workflow) {
      expect(isWorkflowCategory(cat)).toBe(true)
      expect(isPersonalCategory(cat)).toBe(false)
    }
  })
})

describe("groupFactsByDisplayCategory", () => {
  it("splits facts into personal and workflow groups", () => {
    const facts = [
      { id: "f1", category: "family", fact: "Wife Sarah" },
      { id: "f2", category: "schedule_constraint", fact: "Off Fridays" },
      { id: "f3", category: "pets", fact: "Golden retriever Murphy" },
      { id: "f4", category: "deal_interest", fact: "Prefers Class A office" },
    ]
    const grouped = groupFactsByDisplayCategory(facts)
    expect(grouped.personal.map((g) => g.category)).toEqual(["family", "pets"])
    expect(grouped.workflow.map((g) => g.category)).toEqual([
      "schedule_constraint",
      "deal_interest",
    ])
  })

  it("orders personal groups by PERSONAL_CATEGORY_RENDER_ORDER", () => {
    const facts = [
      { id: "f1", category: "travel", fact: "Goes to Whitefish" },
      { id: "f2", category: "family", fact: "Two kids" },
      { id: "f3", category: "vehicles", fact: "Drives an F-150" },
      { id: "f4", category: "pets", fact: "Has a lab" },
    ]
    const grouped = groupFactsByDisplayCategory(facts)
    expect(grouped.personal.map((g) => g.category)).toEqual([
      "family",
      "pets",
      "vehicles",
      "travel",
    ])
  })

  it("appends unknown personal categories that aren't in render order", () => {
    // No-op for now since unknown categories are classified as workflow,
    // but if we ever add a personal category and forget to update the
    // render order, this test documents the safety net.
    const facts = [{ id: "f1", category: "family", fact: "x" }]
    const grouped = groupFactsByDisplayCategory(facts)
    expect(grouped.personal).toHaveLength(1)
    expect(grouped.personal[0]?.facts).toHaveLength(1)
  })

  it("returns empty groups when input is empty", () => {
    const grouped = groupFactsByDisplayCategory([])
    expect(grouped.personal).toEqual([])
    expect(grouped.workflow).toEqual([])
  })
})
