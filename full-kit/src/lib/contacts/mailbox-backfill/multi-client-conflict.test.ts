import { describe, expect, it } from "vitest"

import { detectMultiClientConflict } from "./multi-client-conflict"

const CLIENT_A = { id: "c1", email: "alice@buyer.com" }
const CLIENT_B = { id: "c2", email: "bob@seller.com" }

describe("detectMultiClientConflict", () => {
  it("no client recipients returns null", () => {
    expect(
      detectMultiClientConflict({
        recipientEmails: ["random@stranger.com"],
        candidateClientContacts: [CLIENT_A, CLIENT_B],
        targetContactId: "c1",
      })
    ).toBeNull()
  })

  it("only target contact matches returns null", () => {
    expect(
      detectMultiClientConflict({
        recipientEmails: ["alice@buyer.com"],
        candidateClientContacts: [CLIENT_A, CLIENT_B],
        targetContactId: "c1",
      })
    ).toBeNull()
  })

  it("two clients matched returns conflict with sorted ids", () => {
    expect(
      detectMultiClientConflict({
        recipientEmails: ["alice@buyer.com", "bob@seller.com"],
        candidateClientContacts: [CLIENT_A, CLIENT_B],
        targetContactId: "c1",
      })
    ).toEqual({ matchedContactIds: ["c1", "c2"], primaryContactId: "c1" })
  })

  it("primary is lowest sortable id", () => {
    const result = detectMultiClientConflict({
      recipientEmails: ["alice@buyer.com", "bob@seller.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c2",
    })
    expect(result?.primaryContactId).toBe("c1")
  })

  it("ignores non-client recipients", () => {
    // x@vendor.com is a recipient but NOT in the client candidate set —
    // only alice (the target) is a client → no conflict.
    expect(
      detectMultiClientConflict({
        recipientEmails: ["alice@buyer.com", "x@vendor.com"],
        candidateClientContacts: [CLIENT_A, CLIENT_B],
        targetContactId: "c1",
      })
    ).toBeNull()
  })

  it("case-insensitive email match", () => {
    const result = detectMultiClientConflict({
      recipientEmails: ["ALICE@buyer.com", "Bob@SELLER.com"],
      candidateClientContacts: [CLIENT_A, CLIENT_B],
      targetContactId: "c1",
    })
    expect(result?.matchedContactIds).toEqual(["c1", "c2"])
  })
})
