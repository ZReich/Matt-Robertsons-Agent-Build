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

  // ---- Phase D step 2: NDA detection ------------------------------------

  it("classifies NDA-in-subject as 'nda' at confidence 0.7", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "NDA for 2621 Overland — please review",
      body: "Standard 30-day terms.",
      recipientDomains: ["jll.com"],
    })
    expect(result.signalType).toEqual("nda")
    expect(result.proposedStage).toEqual("prospecting")
    expect(result.confidence).toBeCloseTo(0.7)
  })

  it("classifies 'non-disclosure agreement' in body as 'nda'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Confidentiality docs",
      body: "Attached is the non-disclosure agreement for review.",
      recipientDomains: ["cbre.com"],
    })
    expect(result.signalType).toEqual("nda")
  })

  it("classifies 'confidentiality agreement' in body as 'nda'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Docs",
      body: "Please countersign the confidentiality agreement.",
      recipientDomains: ["colliers.com"],
    })
    expect(result.signalType).toEqual("nda")
  })

  it("does NOT match 'panda' or 'mandatory' as NDA (word-boundary safety)", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Mandatory site visit panda mascot ideas",
      body: "Nothing of substance here.",
      recipientDomains: ["jll.com"],
    })
    expect(result.signalType).toBeNull()
  })

  // ---- Phase D step 2: tenant-rep search detection ----------------------

  it("classifies 'in the market for' as 'tenant_rep_search' at confidence 0.5", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Seeking industrial space",
      body: "My client is in the market for a 50k sf warehouse near Spokane.",
      recipientDomains: ["jll.com"],
    })
    expect(result.signalType).toEqual("tenant_rep_search")
    expect(result.proposedStage).toEqual("prospecting")
    expect(result.confidence).toBeCloseTo(0.5)
  })

  it("classifies 'looking for warehouse' as 'tenant_rep_search'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Buyer search",
      body: "We're looking for warehouse space along the I-90 corridor.",
      recipientDomains: ["cushwake.com"],
    })
    expect(result.signalType).toEqual("tenant_rep_search")
  })

  it("classifies 'exploring options' as 'tenant_rep_search'", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Hi",
      body: "My buyer is exploring options in the Bozeman submarket.",
      recipientDomains: ["newmark.com"],
    })
    expect(result.signalType).toEqual("tenant_rep_search")
  })

  // ---- Precedence: LOI > tour > NDA > tenant_rep ------------------------

  it("LOI takes precedence over NDA when both signals present", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "LOI and NDA package",
      body: "Attached: letter of intent and non-disclosure agreement.",
      recipientDomains: ["cushwake.com"],
    })
    expect(result.signalType).toEqual("loi")
  })

  it("NDA takes precedence over tenant_rep_search when both present", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "NDA",
      body: "My client is in the market for industrial — please countersign the NDA.",
      recipientDomains: ["cushwake.com"],
    })
    expect(result.signalType).toEqual("nda")
  })

  it("tour takes precedence over NDA when both present", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Tour scheduling and NDA package",
      body: "Can we schedule the showing for Tuesday? Also: NDA attached.",
      recipientDomains: ["jll.com"],
    })
    expect(result.signalType).toEqual("tour")
  })

  // ---- Constraint: external broker required ------------------------------

  it("returns null for tenant_rep_search to a non-broker recipient", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "Looking for office",
      body: "We're looking for office space downtown.",
      recipientDomains: ["someclient.com"],
    })
    expect(result.signalType).toBeNull()
  })

  it("returns null for NDA to a non-broker recipient", () => {
    const result = classifyBuyerRepSignal({
      direction: "outbound",
      subject: "NDA",
      body: "Attached non-disclosure agreement.",
      recipientDomains: ["someclient.com"],
    })
    expect(result.signalType).toBeNull()
  })
})
