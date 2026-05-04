import { describe, expect, it } from "vitest"

import { inferDirection } from "./direction"

const TARGET = "mrobertson@naibusinessproperties.com"
const PRIMARY_ONLY = [TARGET]

describe("inferDirection", () => {
  it("from target UPN is outbound", () => {
    expect(
      inferDirection({
        from: "mrobertson@naibusinessproperties.com",
        knownSelfAddresses: PRIMARY_ONLY,
      })
    ).toBe("outbound")
  })

  it("from any other address is inbound", () => {
    expect(
      inferDirection({
        from: "client@buyer.com",
        knownSelfAddresses: PRIMARY_ONLY,
      })
    ).toBe("inbound")
  })

  it("case-insensitive comparison against target UPN", () => {
    expect(
      inferDirection({
        from: "MROBERTSON@NAIBUSINESSPROPERTIES.COM",
        knownSelfAddresses: PRIMARY_ONLY,
      })
    ).toBe("outbound")
  })

  it("missing from defaults to inbound", () => {
    expect(
      inferDirection({ from: null, knownSelfAddresses: PRIMARY_ONLY })
    ).toBe("inbound")
  })

  it("empty from defaults to inbound", () => {
    expect(inferDirection({ from: "", knownSelfAddresses: PRIMARY_ONLY })).toBe(
      "inbound"
    )
  })

  it("treats configured aliases as outbound", () => {
    const aliases = [
      TARGET,
      "matt.robertson@naibusinessproperties.com",
      "matt@nai-old-domain.com",
    ]
    expect(
      inferDirection({
        from: "matt.robertson@naibusinessproperties.com",
        knownSelfAddresses: aliases,
      })
    ).toBe("outbound")
    expect(
      inferDirection({
        from: "MATT@nai-old-domain.com",
        knownSelfAddresses: aliases,
      })
    ).toBe("outbound")
    // A non-alias still inbound.
    expect(
      inferDirection({
        from: "broker@otherfirm.com",
        knownSelfAddresses: aliases,
      })
    ).toBe("inbound")
  })

  it("accepts a Set of self-addresses without re-allocating", () => {
    const set = new Set([TARGET, "alias@nai.com"])
    expect(
      inferDirection({ from: "alias@nai.com", knownSelfAddresses: set })
    ).toBe("outbound")
    expect(
      inferDirection({
        from: "stranger@elsewhere.com",
        knownSelfAddresses: set,
      })
    ).toBe("inbound")
  })
})
