import { describe, expect, it } from "vitest"

import { extractLeadInquiryFacts } from "./inquiry-facts"

describe("extractLeadInquiryFacts", () => {
  it("turns a Crexi inquiry email into display facts", () => {
    const facts = extractLeadInquiryFacts(
      {
        extracted: {
          kind: "inquiry",
          platform: "crexi",
          cityOrMarket: "Billings",
          inquirerName: "Zach Stinson",
          propertyName: "Shiny Ride Car Wash",
        },
      },
      [
        "Regarding listing at 1610 Gleneagles Blvd, Billings, Yellowstone County, MT 59105",
        "",
        "Is this still available for sale ?",
        "",
        "Thank you!",
        "Zach Stinson",
      ].join("\n"),
      "Zach Stinson requesting Information on Shiny Ride Car Wash in Billings"
    )

    expect(facts).toMatchObject({
      kind: "inquiry",
      platform: "crexi",
      inquirerName: "Zach Stinson",
      propertyName: "Shiny Ride Car Wash",
      market: "Billings",
      listingLine:
        "1610 Gleneagles Blvd, Billings, Yellowstone County, MT 59105",
      request: "Is this still available for sale?",
    })
  })

  it("labels favorite signals without inventing a message", () => {
    const facts = extractLeadInquiryFacts(
      {
        from: { displayName: "Alex Wright" },
        extracted: {
          kind: "favorited",
          platform: "loopnet",
          viewerName: "Alex Wright",
          propertyName: "303 N Broadway",
        },
      },
      [
        "[LoopNet] Your Listing Is Getting Noticed!",
        "Hi Matt,",
        "Your listing has been favorited by Alex Wright.",
        "Below is the contact information if you would like to follow up.",
        "[email] wrightcommercial@gmail.com",
        "[phone] +1 239-851-1000<tel:+1%20239-851-1000>",
        "303 N Broadway",
        "Billings, MT 59101",
        "Office For Sale",
        "Is this email helpful?",
        "© 2026 CoStar Group, Inc.",
      ].join("\n"),
      "Alex Wright favorited 303 N Broadway"
    )

    expect(facts.request).toBe("Alex Wright favorited 303 N Broadway.")
    expect(facts.propertyName).toBe("303 N Broadway")
    expect(facts.inquirerName).toBe("Alex Wright")
    expect(facts.contactEmail).toBe("wrightcommercial@gmail.com")
    expect(facts.contactPhone).toBe("+1 239-851-1000")
    expect(facts.market).toBe("Billings")
    expect(facts.address).toBe("303 N Broadway, Billings, MT 59101")
    expect(facts.message).toBeNull()
  })
})
