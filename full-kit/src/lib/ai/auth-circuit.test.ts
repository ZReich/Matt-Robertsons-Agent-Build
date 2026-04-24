import { beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/prisma"

import { assertAuthCircuitClosed, tripAuthCircuit } from "./auth-circuit"

vi.mock("@/lib/prisma", () => ({
  db: {
    systemState: {
      delete: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

describe("auth-circuit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("persists Anthropic auth circuit trips in SystemState", async () => {
    vi.setSystemTime(new Date("2026-04-24T12:00:00.000Z"))

    await tripAuthCircuit("bad key")

    expect(db.systemState.upsert).toHaveBeenCalledWith({
      where: { key: "scrub-circuit-auth" },
      create: {
        key: "scrub-circuit-auth",
        value: {
          trippedAt: "2026-04-24T12:00:00.000Z",
          until: "2026-04-24T12:05:00.000Z",
          reason: "bad key",
        },
      },
      update: {
        value: {
          trippedAt: "2026-04-24T12:00:00.000Z",
          until: "2026-04-24T12:05:00.000Z",
          reason: "bad key",
        },
      },
    })
  })

  it("throws while tripped and clears expired circuit rows", async () => {
    vi.setSystemTime(new Date("2026-04-24T12:00:00.000Z"))
    ;(
      db.systemState.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      value: { until: "2026-04-24T12:05:00.000Z", reason: "bad key" },
    })

    await expect(assertAuthCircuitClosed()).rejects.toMatchObject({
      code: "SCRUB_AUTH_CIRCUIT_OPEN",
    })
    ;(
      db.systemState.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      value: { until: "2026-04-24T11:59:00.000Z", reason: "old" },
    })

    await expect(assertAuthCircuitClosed()).resolves.toBeUndefined()
    expect(db.systemState.delete).toHaveBeenCalledWith({
      where: { key: "scrub-circuit-auth" },
    })
  })
})
