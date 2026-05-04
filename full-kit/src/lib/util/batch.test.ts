import { describe, expect, it } from "vitest"

import { processInBatches } from "./batch"

describe("processInBatches", () => {
  it("processes all items and returns settled results in order", async () => {
    const results = await processInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 2)
    expect(results).toHaveLength(5)
    const values = results.map((r) =>
      r.status === "fulfilled" ? r.value : null
    )
    expect(values).toEqual([2, 4, 6, 8, 10])
  })

  it("isolates per-item failures (one rejection does not block siblings)", async () => {
    const results = await processInBatches(
      [1, 2, 3, 4, 5],
      3,
      async (n) => {
        if (n === 3) throw new Error(`boom-${n}`)
        return n
      }
    )
    expect(results).toHaveLength(5)
    const fulfilled = results.filter((r) => r.status === "fulfilled").length
    const rejected = results.filter((r) => r.status === "rejected").length
    expect(fulfilled).toBe(4)
    expect(rejected).toBe(1)
  })

  it("respects the batchSize concurrency cap", async () => {
    let inFlight = 0
    let maxInFlight = 0
    const results = await processInBatches(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async (i) => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        return i
      }
    )
    expect(results).toHaveLength(10)
    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  it("returns empty array for empty input", async () => {
    const results = await processInBatches([], 5, async (n: number) => n)
    expect(results).toEqual([])
  })

  it("rejects batchSize < 1", async () => {
    await expect(
      processInBatches([1], 0, async (n) => n)
    ).rejects.toThrow(/batchSize must be >= 1/)
  })
})
