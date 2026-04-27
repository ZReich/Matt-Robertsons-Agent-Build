import { describe, expect, it } from "vitest"

import {
  assertRawBodyRetentionPolicy,
  hashBody,
  pruneGraphSnapshot,
  redactEmailBody,
} from "./email-filter-redaction"

describe("email filter redaction", () => {
  it("hashes and redacts sensitive body content", () => {
    const result = redactEmailBody({
      contentType: "text",
      content:
        "Call 406-555-1212. reset https://example.com/reset?token=abc api_key=secret 4111111111111111",
    })
    expect(result.bodyHash).toBe(
      hashBody(
        "Call 406-555-1212. reset https://example.com/reset?token=abc api_key=secret 4111111111111111"
      )
    )
    expect(result.redactedContent).toContain("[REDACTED_PHONE]")
    expect(result.redactedContent).toContain("[REDACTED_LINK]")
    expect(result.redactedContent).toContain("[REDACTED_SECRET]")
    expect(result.redactedContent).toContain("[REDACTED_PAYMENT_LIKE]")
  })

  it("prunes body and bodyPreview from unrestricted graph snapshots", () => {
    const snapshot = pruneGraphSnapshot({
      id: "m1",
      body: { contentType: "text", content: "secret" },
      bodyPreview: "secret preview",
    })
    expect(snapshot.body).toBeUndefined()
    expect(snapshot.bodyPreview).toBeUndefined()
  })

  it("requires expiry and access policy when raw body is retained", () => {
    expect(() =>
      assertRawBodyRetentionPolicy({ rawBodyRetained: true })
    ).toThrow(/requires expiry/)
    expect(() =>
      assertRawBodyRetentionPolicy({
        rawBodyRetained: true,
        rawBodyRetentionExpiresAt: new Date(),
        accessPolicy: "restricted",
      })
    ).not.toThrow()
  })
})
