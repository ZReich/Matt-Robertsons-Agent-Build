import { describe, expect, it } from "vitest"

import {
  parsePipelineFilters,
  serializeDealBoard,
  serializeLeadBoard,
} from "./board"

const now = new Date("2026-04-25T00:00:00Z")

describe("pipeline board serializers", () => {
  it("parses needsFollowup without changing existing filters", () => {
    const filters = parsePipelineFilters(
      new URLSearchParams({
        search: "dana",
        source: "crexi",
        propertyType: "office",
        age: "7_30",
        showAll: "1",
        needsFollowup: "true",
      })
    )

    expect(filters).toMatchObject({
      search: "dana",
      source: "crexi",
      propertyType: "office",
      age: "7_30",
      showAll: true,
      needsFollowup: true,
    })
  })

  it("parses needsFollowup=1 and rejects other values", () => {
    expect(
      parsePipelineFilters(new URLSearchParams({ needsFollowup: "1" }))
        .needsFollowup
    ).toBe(true)
    expect(
      parsePipelineFilters(new URLSearchParams({ needsFollowup: "false" }))
        .needsFollowup
    ).toBe(false)
    expect(parsePipelineFilters(new URLSearchParams()).needsFollowup).toBe(
      false
    )
  })
  it("groups every deal stage and skips null values from money sums", () => {
    const board = serializeDealBoard(
      [
        {
          id: "d1",
          stage: "offer",
          propertyAddress: "123 Main St",
          propertyType: "retail",
          value: "1000000",
          commissionRate: "0.03",
          probability: null,
          listedDate: new Date("2026-04-20T00:00:00Z"),
          stageChangedAt: new Date("2026-04-20T00:00:00Z"),
          createdAt: new Date("2026-04-01T00:00:00Z"),
          updatedAt: new Date("2026-04-20T00:00:00Z"),
          contact: {
            id: "c1",
            name: "Dana Tenant",
            company: "Dana LLC",
            leadSource: "crexi",
          },
        },
        {
          id: "d2",
          stage: "offer",
          propertyAddress: "456 Side St",
          propertyType: "office",
          value: null,
          commissionRate: null,
          probability: 50,
          listedDate: null,
          stageChangedAt: null,
          createdAt: new Date("2026-04-01T00:00:00Z"),
          updatedAt: new Date("2026-04-20T00:00:00Z"),
          contact: null,
        },
      ],
      {},
      now
    )

    expect(board.columns.map((column) => column.id)).toContain("closed")
    const offer = board.columns.find((column) => column.id === "offer")!
    expect(offer.aggregate.count).toBe(2)
    expect(offer.aggregate.grossValue).toBe(1_000_000)
    expect(offer.aggregate.weightedValue).toBe(18_000)
  })

  it("groups leads, extracts earliest inbound snippet, and computes last touch", () => {
    const board = serializeLeadBoard(
      [
        {
          id: "l1",
          name: "Dana Lead",
          company: "Dana LLC",
          email: "dana@example.com",
          leadSource: "loopnet",
          leadStatus: "new",
          leadAt: new Date("2026-04-24T00:00:00Z"),
          estimatedValue: "500000",
          updatedAt: new Date("2026-04-24T00:00:00Z"),
          communications: [
            {
              subject: "Later",
              body: "Later body",
              date: new Date("2026-04-24T00:00:00Z"),
              direction: "inbound",
            },
            {
              subject: "First",
              body: "First body",
              date: new Date("2026-04-23T00:00:00Z"),
              direction: "inbound",
            },
          ],
        },
      ],
      {},
      now
    )

    const fresh = board.columns.find((column) => column.id === "new")!
    expect(fresh.aggregate.count).toBe(1)
    expect(fresh.aggregate.estimatedValue).toBe(500_000)
    expect(fresh.cards[0].snippet).toBe("First")
    expect(fresh.cards[0].lastTouchAt).toBe("2026-04-24T00:00:00.000Z")
  })
})
