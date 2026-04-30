import { describe, expect, it } from "vitest"

import {
  extractBuildoutEvent,
  extractCrexiLead,
  extractLoopNetLead,
} from "./email-extractors"

describe("extractCrexiLead", () => {
  it("parses 'N new leads found for PROPERTY' pattern", () => {
    const r = extractCrexiLead({
      subject: "3 new leads found for West Park Promenade",
      bodyText: "",
    })
    expect(r).toEqual({
      kind: "new-leads-count",
      leadCount: 3,
      propertyName: "West Park Promenade",
    })
  })

  it("parses '1 new leads found for' (singular case in real data)", () => {
    const r = extractCrexiLead({
      subject: "1 new leads found for Hardin Gas Station",
      bodyText: "",
    })
    expect(r).toMatchObject({
      kind: "new-leads-count",
      leadCount: 1,
      propertyName: "Hardin Gas Station",
    })
  })

  it("parses '[Name] requesting Information on PROPERTY in CITY'", () => {
    const r = extractCrexiLead({
      subject:
        "JACKY BRADLEY requesting Information on Burger King | Sidney, MT in Sidney",
      bodyText: "",
    })
    expect(r).toEqual({
      kind: "inquiry",
      inquirerName: "JACKY BRADLEY",
      propertyName: "Burger King | Sidney, MT",
      cityOrMarket: "Sidney",
    })
  })

  it("parses '[Name] entered a note on PROPERTY' as team-note", () => {
    const r = extractCrexiLead({
      subject: "Margaret entered a note on Burger King | Sidney, MT",
      bodyText: "",
    })
    expect(r).toEqual({
      kind: "team-note",
      noteAuthor: "Margaret",
      propertyName: "Burger King | Sidney, MT",
    })
  })

  it("recognizes 'You have NEW leads to be contacted' as inquiry kind", () => {
    const r = extractCrexiLead({
      subject: "You have NEW leads to be contacted",
      bodyText:
        "Name: Jane Doe\nEmail: jane@example.com\nPhone: 555-1212\nCompany: Acme",
    })
    expect(r?.kind).toBe("inquiry")
    expect(r?.inquirer).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1212",
      company: "Acme",
    })
  })

  it("parses inquirer fields from body for 'requesting Information' kind", () => {
    const r = extractCrexiLead({
      subject:
        "Dean Klingner requesting Information on 13 Colorado Ave in Laurel",
      bodyText:
        "Name: Dean Klingner\nEmail: dean@buyer.com\nPhone: (406) 555-0000\nMessage: Interested in the property",
    })
    expect(r?.kind).toBe("inquiry")
    expect(r?.inquirer).toEqual({
      name: "Dean Klingner",
      email: "dean@buyer.com",
      phone: "(406) 555-0000",
      message: "Interested in the property",
    })
  })

  it("parses real Crexi raw name/phone/email body snippets", () => {
    const r = extractCrexiLead({
      subject:
        "JACKY BRADLEY requesting Information on 13 Colorado Ave in Laurel",
      bodyText:
        "Hi, I would like to know more about this listing. Thank you!\nJACKY BRADLEY\n406-555-0100<tel:406-555-0100>\njacky@example.com\nReply",
    })

    expect(r?.inquirer).toEqual({
      name: "JACKY BRADLEY",
      phone: "406-555-0100",
      email: "jacky@example.com",
    })
  })

  it("does not treat Crexi footer support contact as the inquirer email", () => {
    const r = extractCrexiLead({
      subject:
        "Brock Ketcher requesting Information on 13 Colorado Ave in Laurel",
      bodyText:
        "Name: Brock Ketcher\n[Email] support@crexi.com <mailto:support@crexi.com>\n[Phone] + 888.273.0423",
    })

    expect(r?.inquirer?.email).toBeUndefined()
  })

  it("returns null on unrecognized subject", () => {
    const r = extractCrexiLead({ subject: "Some random subject", bodyText: "" })
    expect(r).toBeNull()
  })

  it("returns null on null subject", () => {
    const r = extractCrexiLead({ subject: null, bodyText: "" })
    expect(r).toBeNull()
  })
})

describe("extractLoopNetLead", () => {
  it("parses 'LoopNet Lead for PROPERTY' with body fields", () => {
    const r = extractLoopNetLead({
      subject: "LoopNet Lead for 303 N Broadway",
      bodyText: "Name: Tom Smith\nEmail: tom@buyer.net\nPhone: 406-555-0100",
    })
    expect(r).toEqual({
      kind: "inquiry",
      propertyName: "303 N Broadway",
      inquirer: {
        name: "Tom Smith",
        email: "tom@buyer.net",
        phone: "406-555-0100",
      },
    })
  })

  it("parses real LoopNet pipe-delimited lead body snippets", () => {
    const r = extractLoopNetLead({
      subject: "LoopNet Lead for 303 N Broadway",
      bodyText:
        "New Lead From: Alex Wright | +1 406-555-0100 | alex@example.net | (Listing ID : 37148685)",
    })

    expect(r?.inquirer).toEqual({
      name: "Alex Wright",
      phone: "+1 406-555-0100",
      email: "alex@example.net",
    })
  })

  it("parses LoopNet bracket-label favorite contact snippets", () => {
    const r = extractLoopNetLead({
      subject: "Alex Wright favorited 303 N Broadway",
      bodyText:
        "Your listing has been favorited by Alex Wright.\n[email] alex@example.net<mailto:alex@example.net>\n[phone] +1 406-555-0100<tel:+1 406-555-0100>",
    })

    expect(r).toEqual({
      kind: "favorited",
      viewerName: "Alex Wright",
      propertyName: "303 N Broadway",
      inquirer: {
        email: "alex@example.net",
        phone: "+1 406-555-0100",
      },
    })
  })

  it("parses 'Alex Wright favorited PROPERTY' as favorited kind", () => {
    const r = extractLoopNetLead({
      subject: "Alex Wright favorited 303 N Broadway",
      bodyText: "",
    })
    expect(r).toEqual({
      kind: "favorited",
      viewerName: "Alex Wright",
      propertyName: "303 N Broadway",
    })
  })

  it("returns null for 'Your LoopNet inquiry was sent' (Matt's own outbound confirmation)", () => {
    const r = extractLoopNetLead({
      subject: "Your LoopNet inquiry was sent",
      bodyText: "",
    })
    expect(r).toBeNull()
  })

  it("returns null on unrecognized subject", () => {
    const r = extractLoopNetLead({
      subject: "Random LoopNet update",
      bodyText: "",
    })
    expect(r).toBeNull()
  })
})

describe("extractBuildoutEvent", () => {
  it("parses 'A new Lead has been added - PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "A new Lead has been added - US Bank Building",
      bodyText:
        "Hello, Sam Buyer has viewed your Property Page.\nProfile information on file for Sam Buyer:\nEmail sam@example.com\nPhone 406.555.0100",
    })
    expect(r).toMatchObject({
      kind: "new-lead",
      propertyName: "US Bank Building",
      inquirer: {
        name: "Sam Buyer",
        email: "sam@example.com",
        phone: "406.555.0100",
      },
    })
  })

  it("parses Buildout information-requested lead pair subjects", () => {
    const r = extractBuildoutEvent({
      subject:
        "Rockets | Gourmet Wraps & Sodas - Information Requested by Shae Nielsen",
      bodyText:
        "Profile information on file for Shae Nielsen: Email shae@example.com",
    })
    expect(r).toMatchObject({
      kind: "information-requested",
      propertyName: "Rockets | Gourmet Wraps & Sodas",
      inquirer: { name: "Shae Nielsen", email: "shae@example.com" },
    })
  })

  it("parses 'Deal stage updated on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "Deal stage updated on 2621 Overland",
      bodyText:
        "Deal Stage Updated Hello Matt Robertson, 2621 Overland was updated from Sourcing to Transacting",
    })
    expect(r).toMatchObject({
      kind: "deal-stage-update",
      propertyName: "2621 Overland",
      previousStage: "Sourcing",
      newStage: "Transacting",
    })
  })

  it("keeps multi-word Buildout stage names intact", () => {
    const r = extractBuildoutEvent({
      subject: "Deal stage updated on 303 North Broadway",
      bodyText:
        "Deal Stage Updated Hello Matt Robertson, 303 North Broadway was updated from LOI Offer to Under Contract. View Deal",
    })
    expect(r).toMatchObject({
      kind: "deal-stage-update",
      propertyName: "303 North Broadway",
      previousStage: "LOI Offer",
      newStage: "Under Contract",
    })
  })

  it("parses 'You've been assigned a task'", () => {
    const r = extractBuildoutEvent({
      subject: "Tasks were assigned to you on 7100 Commercial Ave Suite 1",
      bodyText:
        "New Task Assigned Hello Matt Robertson, SIOR, You've been assigned multiple tasks on 7100 Commercial Ave Suite 1 25 APR, 2026 Draft listing Documents [https://example.com]",
    })
    expect(r).toMatchObject({
      kind: "task-assigned",
      propertyName: "7100 Commercial Ave Suite 1",
      taskDueDate: "25 APR, 2026",
      taskTitle: "Draft listing Documents",
    })
  })

  it("parses critical date upcoming", () => {
    const r = extractBuildoutEvent({
      subject: "You have a critical date upcoming",
      bodyText: "",
    })
    expect(r?.kind).toBe("critical-date")
  })

  it("parses 'CA executed on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "CA executed on 2110 Overland Avenue",
      bodyText: "",
    })
    expect(r).toMatchObject({
      kind: "ca-executed",
      propertyName: "2110 Overland Avenue",
    })
  })

  it("parses 'Documents viewed on PROPERTY'", () => {
    const r = extractBuildoutEvent({
      subject: "Documents viewed on US Bank Building",
      bodyText:
        "Samuel Blum viewed NAI_US_Bank.pdf for 303 North Broadway at 2:09 pm CDT on 4/21/26. Profile information on file for Samuel Blum: Name Samuel Blum Company CIG Properties Role Owner Email samuel@example.com Phone 845.659.6659",
    })
    expect(r).toMatchObject({
      kind: "document-view",
      propertyName: "US Bank Building",
      documentName: "NAI_US_Bank.pdf",
      propertyAddress: "303 North Broadway",
      viewer: {
        name: "Samuel Blum",
        email: "samuel@example.com",
        phone: "845.659.6659",
      },
    })
  })

  it("parses Buildout voucher and commission events as revenue evidence", () => {
    expect(
      extractBuildoutEvent({
        subject: "New voucher deposit",
        bodyText:
          "Hello, A deposit was applied. Payer Rove Management Voucher 1601 Lewis | Suite 110 VIEW VOUCHER",
      })
    ).toMatchObject({
      kind: "voucher-deposit",
      payerName: "Rove Management",
      voucherName: "1601 Lewis | Suite 110",
    })

    expect(
      extractBuildoutEvent({
        subject: "New commission payment",
        bodyText:
          "Hello, A payment for your commission was created. Voucher Pure Barre VIEW VOUCHER",
      })
    ).toMatchObject({
      kind: "commission-payment",
      voucherName: "Pure Barre",
    })
  })

  it("parses Buildout listing expiration notices", () => {
    expect(
      extractBuildoutEvent({
        subject:
          "Buildout: 30 day expiration notice for '3218-3226 S. Frontage Road'",
        bodyText: "",
      })
    ).toMatchObject({
      kind: "listing-expiration",
      daysUntilExpiration: 30,
      propertyName: "3218-3226 S. Frontage Road",
    })
  })

  it("returns null for unrelated Buildout email", () => {
    const r = extractBuildoutEvent({
      subject: "Buildout + NAI Business Partners | Meeting Recap",
      bodyText: "",
    })
    expect(r).toBeNull()
  })
})

describe("extractBuildoutEvent — address extraction", () => {
  it("extracts Listing Address line and produces a canonical address-derived key", () => {
    const bodyText = `Hello,

Samuel Blum has viewed your Property Page.

Name    Samuel Blum
Email   samuel@cigprop.com
Phone Number    845.659.6659
When    4/21/26 - 2:08pm CDT
Listing Address 303 North Broadway, Billings, MT 59101
View Lead Details
`
    const result = extractBuildoutEvent({
      subject: "A new Lead has been added - US Bank Building",
      bodyText,
    })
    // propertyAddress preserves the full label-extracted line for human display.
    expect(result?.propertyAddress).toEqual(
      "303 North Broadway, Billings, MT 59101"
    )
    // propertyKey is the canonical key from normalizeBuildoutProperty:
    // lowercased, punctuation stripped, "north" → "n" (per the existing
    // ROAD_SUFFIXES table at property-normalizer.ts:12). The normalizer's
    // ADDRESS_PATTERN truncates at the comma boundary, so the key reflects
    // the street portion only (the plan's expected
    // "303 n broadway billings mt 59101" was an incorrect prediction —
    // the live normalizer returns "303 n broadway").
    expect(result?.propertyKey).toEqual("303 n broadway")
    expect(result?.propertyAddressMissing).toBe(false)
  })

  it("flags addressMissing=true when the Listing Address line is a property name", () => {
    const bodyText = `Hello,

Listing Address Rockets | Gourmet Wraps & Sodas, Billings, MT
`
    const result = extractBuildoutEvent({
      subject: "A new Lead has been added - Rockets | Gourmet Wraps & Sodas",
      bodyText,
    })
    expect(result?.propertyAddress).toEqual(
      "Rockets | Gourmet Wraps & Sodas, Billings, MT"
    )
    // The normalizer still produces a key (name-derived); addressMissing=true
    // signals this to downstream consumers (Phase 5 still creates a Deal,
    // but the key won't match cleanly to other platform inputs for the
    // same property).
    expect(result?.propertyKey).toBeTruthy()
    expect(result?.propertyAddressMissing).toBe(true)
  })

  it("derives a name-only key when the email has no Listing Address line", () => {
    const result = extractBuildoutEvent({
      subject: "Deal stage updated on Alpenglow Healthcare LLC Lease",
      bodyText:
        "Alpenglow Healthcare LLC Lease was updated from Transacting to Closed",
    })
    // No labeled line → propertyAddress stays undefined.
    expect(result?.propertyAddress).toBeUndefined()
    // propertyName from the subject still feeds the normalizer, so a
    // name-derived key comes back. addressMissing=true marks it.
    // (Stage-update emails route through Phase 8's lookup-by-existing-deal,
    // not Phase 5's deal-creation flow, so this key being set is fine.)
    expect(result?.propertyKey).toBeTruthy()
    expect(result?.propertyAddressMissing).toBe(true)
  })
})
