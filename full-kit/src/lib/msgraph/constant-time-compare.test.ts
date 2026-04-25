import { describe, expect, it } from "vitest"

import { constantTimeCompare } from "./constant-time-compare"

describe("constantTimeCompare", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeCompare("hello", "hello")).toBe(true)
  })

  it("returns false for different strings of the same length", () => {
    expect(constantTimeCompare("hello", "world")).toBe(false)
  })

  it("returns false for strings of different lengths", () => {
    expect(constantTimeCompare("a", "ab")).toBe(false)
  })

  it("returns false when one argument is empty", () => {
    expect(constantTimeCompare("", "a")).toBe(false)
    expect(constantTimeCompare("a", "")).toBe(false)
  })

  it("returns true when both arguments are empty", () => {
    expect(constantTimeCompare("", "")).toBe(true)
  })

  it("does not throw on length mismatch (unlike raw timingSafeEqual)", () => {
    expect(() =>
      constantTimeCompare("short", "much-longer-value")
    ).not.toThrow()
  })
})
