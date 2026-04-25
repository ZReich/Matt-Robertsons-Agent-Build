import { describe, expect, it } from "vitest"

import { normalizeSenderAddress } from "./sender-normalize"

describe("normalizeSenderAddress", () => {
  it("passes a plain SMTP address through unchanged (lowercase)", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "Alice@Example.com", name: "Alice" } },
      "matt@naibusinessproperties.com"
    )
    expect(result).toEqual({
      address: "alice@example.com",
      displayName: "Alice",
      isInternal: false,
      normalizationFailed: false,
    })
  })

  it("normalizes Matt's X.500 Exchange DN to SMTP", () => {
    const result = normalizeSenderAddress(
      {
        emailAddress: {
          address:
            "/o=exchangelabs/ou=exchange administrative group (fydibohf23spdlt)/cn=recipients/cn=e7b84e89cfff441fa23381ede928ca5e-mrobertson",
          name: "Matt Robertson",
        },
      },
      "mrobertson@naibusinessproperties.com"
    )
    expect(result).toEqual({
      address: "mrobertson@naibusinessproperties.com",
      displayName: "Matt Robertson",
      isInternal: true,
      normalizationFailed: false,
    })
  })

  it("marks as internal when normalized domain matches target UPN domain", () => {
    const result = normalizeSenderAddress(
      {
        emailAddress: {
          address: "jsmith@naibusinessproperties.com",
          name: "Jennifer",
        },
      },
      "mrobertson@naibusinessproperties.com"
    )
    expect(result.isInternal).toBe(true)
    expect(result.address).toBe("jsmith@naibusinessproperties.com")
  })

  it("marks as external for a different domain", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "client@otherco.com", name: "Client" } },
      "mrobertson@naibusinessproperties.com"
    )
    expect(result.isInternal).toBe(false)
  })

  it("falls back on malformed X.500 DN with normalizationFailed flag", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "/o=broken", name: "Unknown" } },
      "mrobertson@naibusinessproperties.com"
    )
    expect(result.address).toBe("/o=broken")
    expect(result.normalizationFailed).toBe(true)
  })

  it("handles null from gracefully", () => {
    const result = normalizeSenderAddress(
      null,
      "mrobertson@naibusinessproperties.com"
    )
    expect(result.address).toBe("")
    expect(result.normalizationFailed).toBe(true)
  })

  it("uses empty displayName when name is missing", () => {
    const result = normalizeSenderAddress(
      { emailAddress: { address: "x@y.com" } },
      "mrobertson@naibusinessproperties.com"
    )
    expect(result.displayName).toBe("")
  })

  it("correctly extracts a hyphenated SMTP local part from an X.500 DN", () => {
    const result = normalizeSenderAddress(
      {
        emailAddress: {
          address:
            "/o=exchangelabs/ou=exchange administrative group (fydibohf23spdlt)/cn=recipients/cn=e7b84e89cfff441fa23381ede928ca5e-anne-marie",
          name: "Anne-Marie Smith",
        },
      },
      "mrobertson@naibusinessproperties.com"
    )
    expect(result).toEqual({
      address: "anne-marie@naibusinessproperties.com",
      displayName: "Anne-Marie Smith",
      isInternal: true,
      normalizationFailed: false,
    })
  })
})
