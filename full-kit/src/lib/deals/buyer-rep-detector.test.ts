import { describe, expect, it } from "vitest"

import {
  classifyBuyerRepSignal,
  isExternalBrokerDomain,
} from "./buyer-rep-detector"

describe("isExternalBrokerDomain", () => {
  it("returns false for internal NAI", () => {
    expect(isExternalBrokerDomain("partner@naibusinessproperties.com")).toBe(
      false
    )
  })

  it("returns true for known peer-broker domains", () => {
    expect(isExternalBrokerDomain("anyone@cushwake.com")).toBe(true)
    expect(isExternalBrokerDomain("anyone@jll.com")).toBe(true)
    expect(isExternalBrokerDomain("anyone@colliers.com")).toBe(true)
    expect(isExternalBrokerDomain("anyone@cbre.com")).toBe(true)
  })

  it("returns false for client-looking domains", () => {
    expect(isExternalBrokerDomain("client@gmail.com")).toBe(false)
  })
})

describe("classifyBuyerRepSignal", () => {
  it("classifies tour scheduling as 'tour'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Re: Tour scheduling for 2621 Overland",
      body: "Can we schedule the showing for Tuesday at 2pm?",
      recipientDomains: ["jll.com"],
    })
    expect(result.signalType).toEqual("tour")
    expect(result.proposedStage).toEqual("showings")
  })

  it("classifies LOI drafting as 'loi'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "LOI draft for 303 N Broadway — please review",
      body: "Attached is the letter of intent for our review.",
      recipientDomains: ["cushwake.com"],
    })
    expect(result.signalType).toEqual("loi")
    expect(result.proposedStage).toEqual("offer")
  })

  it("returns null for inbound emails (signals are outbound-only)", () => {
    const result = classifyBuyerRepSignal({
      direction: "inbound",
      subject: "Re: Tour scheduling",
      body: "...",
      recipientDomains: [],
    })
    expect(result.signalType).toBeNull()
  })

  it("returns null when recipient is internal NAI", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Re: Tour scheduling",
      body: "...",
      recipientDomains: ["naibusinessproperties.com"],
    })
    expect(result.signalType).toBeNull()
  })
})
