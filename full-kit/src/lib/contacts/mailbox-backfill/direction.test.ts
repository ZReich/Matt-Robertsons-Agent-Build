import { describe, it, expect } from "vitest"
import { inferDirection } from "./direction"

const TARGET = "mrobertson@naibusinessproperties.com"

describe("inferDirection", () => {
  it("from target UPN is outbound", () => {
    expect(inferDirection({
      from: "mrobertson@naibusinessproperties.com",
      targetUpn: TARGET,
    })).toBe("outbound")
  })

  it("from any other address is inbound", () => {
    expect(inferDirection({ from: "client@buyer.com", targetUpn: TARGET })).toBe("inbound")
  })

  it("case-insensitive comparison", () => {
    expect(inferDirection({
      from: "MROBERTSON@NAIBUSINESSPROPERTIES.COM",
      targetUpn: TARGET,
    })).toBe("outbound")
  })

  it("missing from defaults to inbound", () => {
    expect(inferDirection({ from: null, targetUpn: TARGET })).toBe("inbound")
  })

  it("empty from defaults to inbound", () => {
    expect(inferDirection({ from: "", targetUpn: TARGET })).toBe("inbound")
  })
})
