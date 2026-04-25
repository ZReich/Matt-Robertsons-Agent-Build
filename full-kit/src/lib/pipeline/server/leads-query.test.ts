import { describe, expect, it } from "vitest"

import type { LeadContactWithCommunications } from "./leads-query"

import {
  buildLeadContactWhere,
  filterLeadContactsForPipeline,
  getTerminalLeadWhere,
} from "./leads-query"

const now = new Date("2026-04-25T12:00:00Z")
const terminalCutoff = new Date("2026-03-26T12:00:00Z")

function lead(
  overrides: Partial<LeadContactWithCommunications>
): LeadContactWithCommunications {
  return {
    id: "lead-1",
    name: "Dana Lead",
    company: "Acme",
    email: "dana@example.com",
    phone: null,
    role: null,
    preferredContact: null,
    address: null,
    notes: null,
    category: "business",
    tags: [],
    createdBy: null,
    archivedAt: null,
    leadSource: "crexi",
    leadStatus: "new",
    leadAt: new Date("2026-04-20T12:00:00Z"),
    leadLastViewedAt: null,
    estimatedValue: null,
    createdAt: new Date("2026-04-20T12:00:00Z"),
    updatedAt: new Date("2026-04-20T12:00:00Z"),
    communications: [],
    ...overrides,
  } as LeadContactWithCommunications
}

describe("lead pipeline query helpers", () => {
  it("keeps terminal contacts excluded when needsFollowup is active", () => {
    expect(
      getTerminalLeadWhere(
        { showAll: true, needsFollowup: true },
        terminalCutoff
      )
    ).toEqual({
      OR: [
        { leadStatus: { notIn: ["converted", "dropped"] } },
        { leadStatus: null },
      ],
    })
  })

  it("adds a broad inbound prefilter for needsFollowup", () => {
    const where = buildLeadContactWhere(
      {
        search: "dana",
        source: "crexi",
        propertyType: null,
        age: null,
        showAll: false,
        needsFollowup: true,
      },
      terminalCutoff,
      new Date("2026-04-23T12:00:00Z")
    )

    expect(where).toMatchObject({
      AND: expect.arrayContaining([
        { archivedAt: null },
        { leadSource: "crexi" },
        {
          OR: [
            { leadStatus: { notIn: ["converted", "dropped"] } },
            { leadStatus: null },
          ],
        },
        {
          communications: {
            some: {
              direction: "inbound",
              date: { lt: new Date("2026-04-23T12:00:00Z") },
            },
          },
        },
      ]),
    })
    expect(JSON.stringify(where)).toContain('"contains":"dana"')
  })

  it("composes needsFollowup with search instead of overwriting it", () => {
    const where = buildLeadContactWhere(
      {
        search: "needle",
        source: null,
        propertyType: null,
        age: null,
        showAll: false,
        needsFollowup: true,
      },
      terminalCutoff,
      new Date("2026-04-23T12:00:00Z")
    )

    const serialized = JSON.stringify(where)
    expect(serialized).toContain('"contains":"needle"')
    expect(serialized).toContain('"notIn":["converted","dropped"]')
    expect(serialized).toContain('"direction":"inbound"')
    expect(where).toHaveProperty("AND")
  })

  it("filters needsFollowup with complete communication history", () => {
    const matching = lead({
      id: "matching",
      communications: [
        {
          id: "old-inbound",
          subject: null,
          body: null,
          date: new Date("2026-04-20T12:00:00Z"),
          direction: "inbound",
          metadata: {},
        },
        ...Array.from({ length: 25 }, (_, index) => ({
          id: `recent-${index}`,
          subject: null,
          body: null,
          date: new Date(
            `2026-04-24T${String(index % 10).padStart(2, "0")}:00:00Z`
          ),
          direction: null,
          metadata: {},
        })),
      ],
    })
    const answered = lead({
      id: "answered",
      communications: [
        {
          id: "inbound",
          subject: null,
          body: null,
          date: new Date("2026-04-20T12:00:00Z"),
          direction: "inbound",
          metadata: {},
        },
        {
          id: "reply",
          subject: null,
          body: null,
          date: new Date("2026-04-21T12:00:00Z"),
          direction: "outbound",
          metadata: {},
        },
      ],
    })

    const filtered = filterLeadContactsForPipeline(
      [matching, answered],
      {
        search: "",
        source: null,
        propertyType: null,
        age: null,
        showAll: false,
        needsFollowup: true,
      },
      now
    )

    expect(filtered.map((item) => item.id)).toEqual(["matching"])
  })

  it("intersects needsFollowup with age filtering", () => {
    const filtered = filterLeadContactsForPipeline(
      [
        lead({
          id: "fresh",
          leadAt: new Date("2026-04-24T12:00:00Z"),
          communications: [
            {
              id: "inbound",
              subject: null,
              body: null,
              date: new Date("2026-04-20T12:00:00Z"),
              direction: "inbound",
              metadata: {},
            },
          ],
        }),
      ],
      {
        search: "",
        source: null,
        propertyType: null,
        age: "7_30",
        showAll: false,
        needsFollowup: true,
      },
      now
    )

    expect(filtered).toHaveLength(0)
  })
})
