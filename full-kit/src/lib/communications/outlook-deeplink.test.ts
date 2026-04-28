import { describe, expect, it } from "vitest"

import {
  getOutlookDeeplink,
  getOutlookDeeplinkForSource,
  isOutlookReadableSource,
} from "./outlook-deeplink"

describe("getOutlookDeeplink", () => {
  it("URL-encodes the externalMessageId so slashes and spaces survive", () => {
    expect(getOutlookDeeplink("A/B C")).toBe(
      "https://outlook.office.com/mail/deeplink/read/A%2FB%20C"
    )
  })
})

describe("isOutlookReadableSource", () => {
  it("recognizes msgraph and outlook variants regardless of case", () => {
    expect(isOutlookReadableSource("msgraph-email")).toBe(true)
    expect(isOutlookReadableSource("MSGraph-Email")).toBe(true)
    expect(isOutlookReadableSource("microsoft-graph-email")).toBe(true)
    expect(isOutlookReadableSource("outlook")).toBe(true)
  })

  it("rejects gmail-import, generic, and missing source identifiers", () => {
    expect(isOutlookReadableSource("gmail-import")).toBe(false)
    expect(isOutlookReadableSource("crexi-lead")).toBe(false)
    expect(isOutlookReadableSource(null)).toBe(false)
    expect(isOutlookReadableSource(undefined)).toBe(false)
    expect(isOutlookReadableSource("")).toBe(false)
  })
})

describe("getOutlookDeeplinkForSource", () => {
  it("returns the encoded deeplink for an Outlook-readable source", () => {
    expect(getOutlookDeeplinkForSource("A/B C", "msgraph-email")).toBe(
      "https://outlook.office.com/mail/deeplink/read/A%2FB%20C"
    )
  })

  it("returns null when either the externalMessageId or the source is missing", () => {
    expect(getOutlookDeeplinkForSource(null, "msgraph-email")).toBeNull()
    expect(getOutlookDeeplinkForSource("", "msgraph-email")).toBeNull()
    expect(getOutlookDeeplinkForSource("id", null)).toBeNull()
    expect(getOutlookDeeplinkForSource("id", undefined)).toBeNull()
  })

  it("returns null for non-Outlook source systems even with a valid id", () => {
    expect(getOutlookDeeplinkForSource("gmail-1", "gmail-import")).toBeNull()
    expect(getOutlookDeeplinkForSource("loopnet-1", "crexi-lead")).toBeNull()
  })
})
