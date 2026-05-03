import { describe, expect, it } from "vitest"

import { containsSensitiveContent } from "./sensitive-filter"

describe("containsSensitiveContent", () => {
  it("flags emails that mention wire transfer instructions", () => {
    const r = containsSensitiveContent(
      "Wiring instructions for closing",
      "Please use the wire instructions below for closing escrow."
    )
    expect(r.tripped).toBe(true)
    expect(r.reasons).toContain("keyword:wire instructions")
  })

  it("flags emails containing an SSN-shaped string", () => {
    const r = containsSensitiveContent(
      null,
      "His SSN is 123-45-6789, please update the file."
    )
    expect(r.tripped).toBe(true)
    expect(r.reasons).toContain("pattern:ssn")
  })

  it("flags emails with bank statements attached", () => {
    const r = containsSensitiveContent(
      "Bank statement for Q1",
      "Attached is the bank statement for review."
    )
    expect(r.tripped).toBe(true)
    expect(r.reasons.some((reason) => reason.includes("bank statement"))).toBe(true)
  })

  it("flags routing number context but not raw 9-digit codes alone", () => {
    const banky = containsSensitiveContent(
      "ABA routing details",
      "ABA routing 123456789, account 9876543210"
    )
    expect(banky.tripped).toBe(true)
    expect(
      banky.reasons.some((r) =>
        r.includes("pattern:routing_number_in_banking_context")
      )
    ).toBe(true)

    const benign = containsSensitiveContent(
      null,
      "Tracking number 123456789 — UPS will deliver Friday."
    )
    expect(benign.tripped).toBe(false)
  })

  it("flags payment card context but not random long numbers", () => {
    const card = containsSensitiveContent(
      "Card on file",
      "Visa card 4111-1111-1111-1111 exp 12/27, please update."
    )
    expect(card.tripped).toBe(true)

    // Benign: 16-digit MLS-style number with no card-context word nearby.
    const benign = containsSensitiveContent(
      "Listing reference",
      "MLS reference 1234567890123456 attached for tour scheduling."
    )
    expect(benign.tripped).toBe(false)
  })

  it("does not flag ordinary CRE inquiries", () => {
    const r = containsSensitiveContent(
      "Inquiry on 303 N Broadway",
      "Hi Matt — interested in the listing at 303 N Broadway. Please send rent rolls and OM. Thanks, Brandon"
    )
    expect(r.tripped).toBe(false)
  })

  it("flags loan documents references", () => {
    const r = containsSensitiveContent(
      "Loan documents",
      "Sending over the executed promissory note and loan agreement."
    )
    expect(r.tripped).toBe(true)
    expect(
      r.reasons.some((reason) => reason.includes("loan") || reason.includes("promissory"))
    ).toBe(true)
  })

  it("returns clean result when subject and body are null", () => {
    const r = containsSensitiveContent(null, null)
    expect(r.tripped).toBe(false)
    expect(r.reasons).toEqual([])
  })

  it("flags 1099 / W-9 / K-1 tax document references", () => {
    expect(containsSensitiveContent("1099 for 2025", null).tripped).toBe(true)
    expect(containsSensitiveContent(null, "Please return signed W-9").tripped).toBe(true)
    expect(
      containsSensitiveContent(null, "Your K-1 is attached for taxes.").tripped
    ).toBe(true)
  })

  it("flags ITIN and checking/savings account references", () => {
    expect(
      containsSensitiveContent("New ITIN application", null).tripped
    ).toBe(true)
    expect(
      containsSensitiveContent(
        null,
        "Wire it from my checking account when ready."
      ).tripped
    ).toBe(true)
    expect(
      containsSensitiveContent(
        null,
        "We hold the savings account at Bank of Bozeman."
      ).tripped
    ).toBe(true)
  })

  it("flags SSN with spaces in addition to dashes", () => {
    expect(containsSensitiveContent(null, "His SSN is 123 45 6789").tripped).toBe(
      true
    )
  })

  it("does not flag a 9-digit number outside banking context", () => {
    const r = containsSensitiveContent(
      null,
      "Tracking number 123456789 — UPS will deliver Friday."
    )
    expect(r.tripped).toBe(false)
  })

  it("aggregates multiple reasons rather than short-circuiting", () => {
    const r = containsSensitiveContent(
      "Closing — wire instructions",
      "Bank statement attached. Please confirm wire instructions and SSN 123-45-6789."
    )
    expect(r.tripped).toBe(true)
    expect(r.reasons.length).toBeGreaterThan(2)
  })
})
