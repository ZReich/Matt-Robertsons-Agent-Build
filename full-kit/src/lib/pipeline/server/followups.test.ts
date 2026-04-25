import { describe, expect, it } from "vitest"

import {
  getMissedFollowupCutoff,
  hasMissedFollowup,
  selectMissedFollowupReference,
} from "./followups"

describe("missed follow-up helpers", () => {
  const cutoff = new Date("2026-04-23T12:00:00Z")

  it("selects the oldest inbound older than cutoff with no later outbound", () => {
    const reference = selectMissedFollowupReference(
      [
        {
          id: "newer",
          date: new Date("2026-04-22T12:00:00Z"),
          direction: "inbound",
        },
        {
          id: "oldest",
          date: new Date("2026-04-20T12:00:00Z"),
          direction: "inbound",
        },
      ],
      cutoff
    )

    expect(reference?.id).toBe("oldest")
  })

  it("ignores inbound messages with a later outbound reply", () => {
    expect(
      hasMissedFollowup(
        [
          {
            id: "inbound",
            date: new Date("2026-04-20T12:00:00Z"),
            direction: "inbound",
          },
          {
            id: "reply",
            date: new Date("2026-04-21T12:00:00Z"),
            direction: "outbound",
          },
        ],
        cutoff
      )
    ).toBe(false)
  })

  it("ignores recent inbound and null direction messages", () => {
    expect(
      hasMissedFollowup(
        [
          {
            id: "recent",
            date: new Date("2026-04-24T12:00:00Z"),
            direction: "inbound",
          },
          {
            id: "unknown",
            date: new Date("2026-04-20T12:00:00Z"),
            direction: null,
          },
        ],
        cutoff
      )
    ).toBe(false)
  })

  it("computes a two-day cutoff", () => {
    expect(getMissedFollowupCutoff(new Date("2026-04-25T12:00:00Z"))).toEqual(
      new Date("2026-04-23T12:00:00Z")
    )
  })
})
