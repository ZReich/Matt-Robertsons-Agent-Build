import { describe, expect, it } from "vitest"

import type { ContactRef, DealRef } from "./matcher"
import type { PlaudRecording } from "./types"

import { suggestContacts, suggestDeals } from "./matcher"

const baseRec: PlaudRecording = {
  id: "rec-1",
  filename: "Untitled",
  filesize: 100,
  durationSeconds: 600,
  startTime: new Date("2026-05-04T14:30:00Z"),
  endTime: new Date("2026-05-04T14:40:00Z"),
  isTranscribed: true,
  isSummarized: true,
  tagIds: [],
  keywords: [],
}

const contacts: ContactRef[] = [
  { id: "c-bob", fullName: "Bob Smith", aliases: ["Bobby"] },
  { id: "c-sarah", fullName: "Sarah Jones", aliases: [] },
  { id: "c-tyrer", fullName: "Mike Tyrer", aliases: [] },
  { id: "c-empty", fullName: "", aliases: [] },
]

const emptySignals = {
  counterpartyName: null,
  topic: null,
  mentionedCompanies: [],
  mentionedProperties: [],
  tailSynopsis: null,
}

describe("suggestContacts", () => {
  it("ranks tail_synopsis highest when name matches", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "...",
      extractedSignals: {
        counterpartyName: "Bob Smith",
        topic: null,
        mentionedCompanies: [],
        mentionedProperties: [],
        tailSynopsis: "this call was with Bob Smith",
      },
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0].contactId).toBe("c-bob")
    expect(result[0].source).toBe("tail_synopsis")
    expect(result[0].score).toBeGreaterThanOrEqual(90)
  })

  it("uses filename when no tail synopsis", () => {
    const result = suggestContacts({
      recording: { ...baseRec, filename: "Sarah lease talk" },
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0].contactId).toBe("c-sarah")
    expect(result[0].source).toBe("filename")
  })

  it("uses tag map when filename has no match", () => {
    const result = suggestContacts({
      recording: { ...baseRec, tagIds: ["tag-tyrer"] },
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: { "tag-tyrer": "c-tyrer" },
    })
    expect(result[0].contactId).toBe("c-tyrer")
    expect(result[0].source).toBe("folder_tag")
  })

  it("uses meeting proximity within 60 minutes", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [
        {
          contactId: "c-bob",
          date: new Date("2026-05-04T14:35:00Z"),
        },
      ],
      tagToContactMap: {},
    })
    expect(result[0].contactId).toBe("c-bob")
    expect(result[0].source).toBe("meeting_proximity")
    expect(result[0].score).toBe(70)
  })

  it("medium meeting proximity (>15 min) gets a lower score", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [
        {
          contactId: "c-bob",
          date: new Date("2026-05-04T13:50:00Z"), // 40 min before
        },
      ],
      tagToContactMap: {},
    })
    expect(result[0].source).toBe("meeting_proximity")
    expect(result[0].score).toBe(50)
  })

  it("skips meeting proximity when ambiguous (multiple meetings in window)", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [
        { contactId: "c-bob", date: new Date("2026-05-04T14:35:00Z") },
        { contactId: "c-sarah", date: new Date("2026-05-04T14:25:00Z") },
      ],
      tagToContactMap: {},
    })
    expect(result.find((s) => s.source === "meeting_proximity")).toBeUndefined()
  })

  it("returns up to 3 deduped suggestions, taking the highest source per contact", () => {
    const result = suggestContacts({
      recording: {
        ...baseRec,
        filename: "Bob Smith call",
        tagIds: ["tag-bob"],
      },
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        counterpartyName: "Bob Smith",
        tailSynopsis: "with Bob Smith",
      },
      contacts,
      scheduledMeetings: [],
      tagToContactMap: { "tag-bob": "c-bob" },
    })
    expect(result.filter((s) => s.contactId === "c-bob")).toHaveLength(1)
    expect(result[0].source).toBe("tail_synopsis")
  })

  it("returns empty array when no signals match", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result).toEqual([])
  })

  it("uses transcript opening NLP as a low-weight fallback", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "Speaker 1: Hi, this is Sarah Jones from Acme.",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0].contactId).toBe("c-sarah")
    expect(result[0].source).toBe("transcript_open")
  })

  it("ignores contacts with empty fullName (defensive)", () => {
    const result = suggestContacts({
      recording: { ...baseRec, filename: "" },
      cleanedText: "",
      extractedSignals: { ...emptySignals, counterpartyName: "" },
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result.find((s) => s.contactId === "c-empty")).toBeUndefined()
  })

  it("matches alias when fullName doesn't hit", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "Speaker 1: Hi Bobby, how's it going?",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0].contactId).toBe("c-bob")
  })

  it("survives malicious counterpartyName with regex metacharacters", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        counterpartyName: ".*+?^${}()|[]\\BobAttacker",
        tailSynopsis: ".*+?^${}()|[]\\BobAttacker",
      },
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    // Should not throw, and should not match a contact named "Bob Smith"
    // just because the attacker prefixed with regex chars.
    expect(result.find((s) => s.contactId === "c-bob")).toBeUndefined()
  })

  it("survives extremely long counterpartyName without DOSing", () => {
    const long = "Bob ".repeat(50_000)
    const start = Date.now()
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: { ...emptySignals, counterpartyName: long },
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(Date.now() - start).toBeLessThan(500)
    // Behavior: long name still tokenizes fine, may match Bob.
    expect(result).toBeDefined()
  })

  it("does not crash on empty contacts list", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "Sarah",
      extractedSignals: { ...emptySignals, counterpartyName: "Sarah" },
      contacts: [],
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result).toEqual([])
  })

  it("limits to top 3 suggestions even with many candidates", () => {
    const manyContacts: ContactRef[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c-${i}`,
      fullName: `Person${i}`,
      aliases: [],
    }))
    // Filename mentions 5 of them.
    const result = suggestContacts({
      recording: {
        ...baseRec,
        filename: "Person1 Person2 Person3 Person4 Person5",
      },
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts: manyContacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it("token-boundary: 'Bob' does NOT match 'lobby' as a substring", () => {
    const result = suggestContacts({
      recording: { ...baseRec, filename: "the lobby was crowded" },
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts: [{ id: "c-bob-only", fullName: "Bob", aliases: [] }],
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result).toEqual([])
  })

  it("token-boundary: 'Bob Smith' DOES match 'i was talking to bob smith yesterday'", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "Speaker 1: i was talking to bob smith yesterday",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0].contactId).toBe("c-bob")
  })

  it("ambiguous tie at top score → no suggestion", () => {
    const result = suggestContacts({
      recording: { ...baseRec, filename: "John meeting" },
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts: [
        { id: "c-john1", fullName: "John Smith", aliases: [] },
        { id: "c-john2", fullName: "John Doe", aliases: [] },
        { id: "c-john3", fullName: "John Brown", aliases: [] },
      ],
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    // All three Johns tie at 0.5 (one token of two matched). Suppress.
    expect(result.find((s) => s.source === "filename")).toBeUndefined()
  })

  it("surfaces ambiguous AI counterparty names as review candidates", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        counterpartyName: "Michelle",
      },
      contacts: [
        { id: "c-m1", fullName: "Michelle Fleming", aliases: [] },
        { id: "c-m2", fullName: "Michelle Donahey", aliases: [] },
        { id: "c-other", fullName: "Sarah Jones", aliases: [] },
      ],
      scheduledMeetings: [],
      tagToContactMap: {},
    })

    expect(result).toHaveLength(2)
    expect(result.map((s) => s.source)).toEqual([
      "counterparty_candidate",
      "counterparty_candidate",
    ])
    expect(result[0]?.score).toBeLessThan(60)
  })

  it("suggests a deal when extractedSignals.mentionedProperties matches Deal.propertyAddress", () => {
    const deals: DealRef[] = [
      {
        id: "d-1",
        contactId: "c-bob",
        contactName: "Bob Smith",
        propertyAddress: "123 Main St, Billings",
        propertyAliases: [],
      },
      {
        id: "d-2",
        contactId: "c-sarah",
        contactName: "Sarah Jones",
        propertyAddress: "456 Oak Ave",
        propertyAliases: [],
      },
    ]
    const result = suggestDeals({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        mentionedProperties: ["123 Main St"],
      },
      contacts: [],
      deals,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0]?.dealId).toBe("d-1")
    expect(result[0]?.source).toBe("mentioned_property")
    expect(result[0]?.contactId).toBe("c-bob")
  })

  it("returns multiple deal candidates when a property mention ties across active deals", () => {
    const deals: DealRef[] = [
      {
        id: "d-1",
        contactId: "c-bob",
        contactName: "Bob Smith",
        propertyAddress: "123 Main St",
        propertyAliases: [],
      },
      {
        id: "d-2",
        contactId: "c-sarah",
        contactName: "Sarah Jones",
        propertyAddress: "123 Main St",
        propertyAliases: [],
      },
    ]
    const result = suggestDeals({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        mentionedProperties: ["123 Main St"],
      },
      contacts: [],
      deals,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result.map((s) => s.dealId).sort()).toEqual(["d-1", "d-2"])
    expect(result[0]?.reason).toContain("multiple active deals")
  })

  it("suggests a deal when counterpartyName matches the deal's primary contact", () => {
    const deals: DealRef[] = [
      {
        id: "d-bob",
        contactId: "c-bob",
        contactName: "Bob Smith",
        propertyAddress: "999 Oak",
        propertyAliases: [],
      },
    ]
    const result = suggestDeals({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        counterpartyName: "Bob Smith",
      },
      contacts: [],
      deals,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result[0]?.dealId).toBe("d-bob")
    expect(result[0]?.source).toBe("deal_contact_name")
  })

  it("returns multiple deal candidates when one contact has multiple active deals", () => {
    const deals: DealRef[] = [
      {
        id: "d-bob-1",
        contactId: "c-bob",
        contactName: "Bob Smith",
        propertyAddress: "123 Main",
        propertyAliases: [],
      },
      {
        id: "d-bob-2",
        contactId: "c-bob",
        contactName: "Bob Smith",
        propertyAddress: "456 Oak",
        propertyAliases: [],
      },
    ]
    const result = suggestDeals({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        counterpartyName: "Bob Smith",
      },
      contacts: [],
      deals,
      scheduledMeetings: [],
      tagToContactMap: {},
    })

    expect(result.map((s) => s.dealId)).toEqual(["d-bob-1", "d-bob-2"])
    expect(result.every((s) => s.source === "deal_contact_name")).toBe(true)
  })

  it("returns empty array when no deals corpus", () => {
    const result = suggestDeals({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        mentionedProperties: ["123 Main"],
      },
      contacts: [],
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result).toEqual([])
  })

  it("synopsis below 0.85 threshold falls through (no tail_synopsis suggestion)", () => {
    const result = suggestContacts({
      recording: baseRec,
      cleanedText: "",
      extractedSignals: {
        ...emptySignals,
        // "talked to bob" — "bob" matches but "smith" doesn't → 0.5 < 0.85
        tailSynopsis: "talked to bob",
      },
      contacts,
      scheduledMeetings: [],
      tagToContactMap: {},
    })
    expect(result.find((s) => s.source === "tail_synopsis")).toBeUndefined()
  })

  it("does not surface a tag → unknown contact mapping", () => {
    const result = suggestContacts({
      recording: { ...baseRec, tagIds: ["tag-orphan"] },
      cleanedText: "",
      extractedSignals: emptySignals,
      contacts,
      scheduledMeetings: [],
      tagToContactMap: { "tag-orphan": "c-deleted-no-longer-exists" },
    })
    expect(result).toEqual([])
  })
})
