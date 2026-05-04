import { describe, expect, it } from "vitest"

import { dedupeBuildoutLeadEvents } from "./lead-dedupe"
import { normalizeBuildoutProperty } from "./property-normalizer"
import { mapBuildoutStage } from "./stages"
import { evaluateStaleDeal, evaluateWaitingOnOther } from "./stale-policy"

describe("Buildout stages", () => {
  it.each([
    ["Sourcing", "sourcing"],
    ["Evaluating", "evaluating"],
    ["Transacting", "transacting"],
    ["Under Contract", "under_contract"],
    ["Due Diligence", "due_diligence"],
    ["LOI Offer", "loi_offer"],
    ["Commission Realized", "commission_realized"],
    ["Closed", "closed"],
    ["Dead", "dead"],
  ] as const)("maps %s to canonical %s", (raw, canonical) => {
    expect(mapBuildoutStage(raw)).toMatchObject({
      sourceStageRaw: raw,
      canonicalStage: canonical,
      confidence: 1,
    })
  })

  it("keeps unmapped stages explicit instead of coercing", () => {
    expect(mapBuildoutStage("Mystery")).toMatchObject({
      canonicalStage: "unknown",
      reason: "unmapped-buildout-stage",
    })
  })
})

describe("Buildout property normalization", () => {
  it.each([
    ["1601 Lewis", "1601 lewis", undefined],
    ["1601 Lewis | Suite 110", "1601 lewis", "suite 110"],
    ["1110 Lynn Avenue", "1110 lynn ave", undefined],
    ["4H Plumbing -1110 Lynn Avenue", "1110 lynn ave", undefined],
    ["421 North 24th Street | .", "421 n 24th st", undefined],
    ["2621 Overland - Suite A", "2621 overland", "suite a"],
  ] as const)("normalizes %s", (raw, key, suite) => {
    expect(normalizeBuildoutProperty(raw)).toMatchObject({
      normalizedPropertyKey: key,
      ...(suite ? { unitOrSuite: suite } : {}),
    })
  })

  it("uses body address as stronger canonical key", () => {
    expect(
      normalizeBuildoutProperty(
        "US Bank Building",
        "Samuel viewed NAI_US_Bank.pdf for 303 North Broadway at 2:09 pm"
      )
    ).toMatchObject({
      normalizedPropertyKey: "303 n broadway",
      propertyAddressRaw: "303 North Broadway",
      aliases: expect.arrayContaining(["US Bank Building"]),
    })
  })

  it("does not let task date text pollute the property key", () => {
    expect(
      normalizeBuildoutProperty(
        "7100 Commercial Ave Suite 1",
        "7100 Commercial Ave Suite 1 25 APR, 2026 Send tour follow-up"
      )
    ).toMatchObject({
      normalizedPropertyKey: "7100 commercial ave",
      unitOrSuite: "suite 1",
    })
  })

  it("keeps business-name-only properties reviewable", () => {
    expect(
      normalizeBuildoutProperty("Rockets | Gourmet Wraps & Sodas")
    ).toMatchObject({
      normalizedPropertyKey: "rockets gourmet wraps & sodas",
      addressMissing: true,
    })
  })
})

describe("Buildout lead dedupe", () => {
  it("groups paired new-lead and information-requested emails into one card", () => {
    const receivedAt = new Date("2026-04-20T15:40:48Z")
    const groups = dedupeBuildoutLeadEvents([
      {
        id: "new-lead",
        kind: "new-lead",
        subject: "A new Lead has been added - Rockets | Gourmet Wraps & Sodas",
        propertyName: "Rockets | Gourmet Wraps & Sodas",
        inquirerName: "Shae Nielsen",
        receivedAt,
      },
      {
        id: "info-requested",
        kind: "information-requested",
        subject:
          "Rockets | Gourmet Wraps & Sodas - Information Requested by Shae Nielsen",
        propertyName: "Rockets | Gourmet Wraps & Sodas",
        inquirerName: "Shae Nielsen",
        receivedAt: new Date("2026-04-20T15:40:51Z"),
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      primary: expect.objectContaining({ id: "new-lead" }),
      suppressed: [expect.objectContaining({ id: "info-requested" })],
    })
  })

  it("does not suppress unrelated unknown-person leads on the same property", () => {
    const receivedAt = new Date("2026-04-20T15:40:48Z")
    const groups = dedupeBuildoutLeadEvents([
      {
        id: "unknown-a",
        kind: "new-lead",
        subject: "A new Lead has been added - 303 North Broadway",
        propertyName: "303 North Broadway",
        receivedAt,
      },
      {
        id: "unknown-b",
        kind: "information-requested",
        subject: "303 North Broadway - Information Requested",
        propertyName: "303 North Broadway",
        receivedAt: new Date("2026-04-20T15:40:51Z"),
      },
    ])

    expect(groups).toHaveLength(2)
    expect(groups.flatMap((group) => group.suppressed)).toHaveLength(0)
    expect(new Set(groups.map((group) => group.dedupeKey)).size).toBe(2)
  })
})

describe("stale deal policy", () => {
  const now = new Date("2026-04-26T12:00:00Z")

  it("marks active deals stale after fourteen days without meaningful activity", () => {
    expect(
      evaluateStaleDeal(
        { lastMattTouchAt: new Date("2026-04-10T12:00:00Z") },
        now
      )
    ).toMatchObject({
      stale: true,
      reason: "active-deal-no-meaningful-activity",
    })
  })

  it("marks waiting-on-other stale after seven days without response", () => {
    expect(
      evaluateWaitingOnOther(new Date("2026-04-18T12:00:00Z"), null, now)
    ).toMatchObject({
      stale: true,
      reason: "waiting-on-other-threshold-exceeded",
    })
  })

  it("excludes dead and closed deals from active stale queue", () => {
    expect(evaluateStaleDeal({ stage: "dead" }, now)).toMatchObject({
      stale: false,
      reason: "inactive-stage",
    })
  })

  it("treats external engagement as meaningful activity", () => {
    expect(
      evaluateStaleDeal(
        {
          lastMattTouchAt: new Date("2026-04-01T12:00:00Z"),
          lastExternalEngagementAt: new Date("2026-04-25T12:00:00Z"),
        },
        now
      )
    ).toMatchObject({
      stale: false,
      reason: "recent-meaningful-activity",
    })
  })

  it("does not mark stale when a future reminder is already scheduled", () => {
    expect(
      evaluateStaleDeal(
        {
          lastMattTouchAt: new Date("2026-04-01T12:00:00Z"),
          nextReminderAt: new Date("2026-04-27T12:00:00Z"),
        },
        now
      )
    ).toMatchObject({
      stale: false,
      reason: "reminder-scheduled",
    })
  })
})

describe("normalizeBuildoutProperty — cross-platform parity", () => {
  it("Buildout 'Listing Address' line and LoopNet pipe format produce the same key", () => {
    const buildoutBody =
      "Hello,\n\nName Samuel Blum\nListing Address 303 North Broadway, Billings, MT 59101\nView Lead Details"
    const loopnetBody =
      "New Lead\nFrom: Alex Wright\n303 N Broadway | Billings, MT 59101"
    const buildout = normalizeBuildoutProperty("US Bank Building", buildoutBody)
    const loopnet = normalizeBuildoutProperty("303 N Broadway", loopnetBody)
    expect(buildout?.normalizedPropertyKey).toEqual(
      loopnet?.normalizedPropertyKey
    )
  })

  it("Crexi 'Regarding listing at' with county strips county and matches no-county form", () => {
    const withCounty = normalizeBuildoutProperty(
      "Montana Paint Building",
      "Regarding listing at 2610 Montana Ave, Billings, Yellowstone County, MT 59101"
    )
    const without = normalizeBuildoutProperty(
      "Montana Paint Building",
      "2610 Montana Ave, Billings, MT 59101"
    )
    expect(withCounty?.normalizedPropertyKey).toEqual(
      without?.normalizedPropertyKey
    )
  })

  it("LoopNet 'favorited' subject-only path produces a key that prefixes the full body-derived key", () => {
    const subjectOnly = normalizeBuildoutProperty("303 N Broadway", "")
    const full = normalizeBuildoutProperty(
      "303 N Broadway",
      "303 N Broadway | Billings, MT 59101"
    )
    expect(subjectOnly).not.toBeNull()
    expect(full).not.toBeNull()
    expect(
      full!.normalizedPropertyKey.startsWith(subjectOnly!.normalizedPropertyKey)
    ).toBe(true)
  })

  it("returns addressMissing=true when the input is a property name only", () => {
    const result = normalizeBuildoutProperty(
      "Rockets | Gourmet Wraps & Sodas",
      "Listing Address Rockets | Gourmet Wraps & Sodas, Billings, MT"
    )
    expect(result?.addressMissing).toBe(true)
    expect(result?.normalizedPropertyKey).toBeTruthy()
  })
})
