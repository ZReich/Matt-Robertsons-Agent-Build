import { describe, expect, it } from "vitest"

import {
  getOutlookDeeplink,
  getOutlookDeeplinkForSource,
} from "./outlook-deeplink"

describe("TodoDetailDrawer source links", () => {
  it("builds the Outlook deeplink for a Prisma source communication", () => {
    expect(getOutlookDeeplink("A/B C")).toMatchInlineSnapshot(
      `"https://outlook.office.com/mail/deeplink/read/A%2FB%20C"`
    )
  })

  it("only builds source-aware links for Outlook-readable sources", () => {
    expect(getOutlookDeeplinkForSource("A/B C", "msgraph-email")).toBe(
      "https://outlook.office.com/mail/deeplink/read/A%2FB%20C"
    )
    expect(getOutlookDeeplinkForSource("gmail-1", "gmail-import")).toBeNull()
  })
})
