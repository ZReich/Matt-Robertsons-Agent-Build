import { describe, expect, it } from "vitest"

import { daysSince, getAgeBucket, getAgeBucketForDate } from "./age-buckets"

describe("age buckets", () => {
  it.each([
    [6, "lt7"],
    [7, "7_30"],
    [30, "7_30"],
    [31, "30_90"],
    [90, "30_90"],
    [91, "gt90"],
  ] as const)("maps %i days", (days, bucket) => {
    expect(getAgeBucket(days)).toBe(bucket)
  })

  it("handles null dates without throwing", () => {
    expect(daysSince(null)).toBeNull()
    expect(getAgeBucketForDate(null)).toBeNull()
  })
})
