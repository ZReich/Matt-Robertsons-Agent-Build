import { describe, expect, it } from "vitest"

import { cleanLeadMessageText } from "./message-text"

describe("cleanLeadMessageText", () => {
  it("removes markdown image URLs and tracking links while keeping the lead message", () => {
    const input = `" [https://files.crexi.com/email-images/crexi_logo_black.png]
<https://email.notifications.crexi.com/c/eJxM...AAA_YMISIQ> Regarding listing at 110 N 24th St, Billings, Yellowstone County, MT 59101 Dear Current Owner of Record, My name is Jehoni Williams, and I serve as Trustee. Please confirm your relationship to the property.
Reply<https://email.notifications.crexi.com/c/eJwszMFOx...CC5Vtg> [Phone]
<https://email.notifications.crexi.com/c/eJwszMFOx...CC5Vtg> [Email] support@crexi.com <mailto:support@crexi.com> [Phone] + 888.273.0423 © 2026 Commercial Real Estate Exchange, Inc., All rights reserved.`

    const cleaned = cleanLeadMessageText(input)

    expect(cleaned).toContain("Regarding listing at 110 N 24th St")
    expect(cleaned).toContain(
      "Please confirm your relationship to the property."
    )
    expect(cleaned).not.toContain("crexi_logo_black")
    expect(cleaned).not.toContain("https://")
    expect(cleaned).not.toContain("mailto:")
    expect(cleaned).not.toContain("support@crexi.com")
    expect(cleaned).not.toContain("© 2026")
  })

  it("removes Crexi text-message opt-in footer content", () => {
    const input =
      "I look forward to your response. Sincerely, Jehoni Williams. Want to receive this message as a text? Click here. <https://email.notifications.crexi.com/c/foo>"

    expect(cleanLeadMessageText(input)).toBe(
      "I look forward to your response.\n\nSincerely, Jehoni Williams."
    )
  })

  it("breaks cleaned email text into readable chunks", () => {
    const input =
      "Regarding listing at 110 N 24th St, Billings, Yellowstone County, MT 59101 Dear Current Owner of Record, My name is Jehoni Williams, and I serve as Trustee of The Jehoni Kierre Williams Living Trust. I am reaching out regarding your commercial apartment complex. My investors and I have a strong interest in acquiring this asset. After further internal review and discussions with our investment partners, we would like to formally express our intent to purchase the property, should your company still have an interest in selling. Before proceeding further, we would appreciate clarification on a few items: Please confirm your relationship to the property. Is there currently a mortgage in place? If so, what is the maturity date and remaining balance? If these details are not readily available, we kindly request the most recent financial statements and any supporting documentation. This will allow us to properly evaluate the asset and present a structured and appropriate offer. We appreciate your time and consideration and look forward to your response. Sincerely, The Jehoni Kierre Williams Living Trust Jehoni Kierre Williams, Trustee Email: jehoniwilliams02@gmail.com Phone: (409) 937-0620"

    expect(cleanLeadMessageText(input)).toBe(
      [
        "Regarding listing at 110 N 24th St, Billings, Yellowstone County, MT 59101",
        "Dear Current Owner of Record,",
        "My name is Jehoni Williams, and I serve as Trustee of The Jehoni Kierre Williams Living Trust.",
        "I am reaching out regarding your commercial apartment complex. My investors and I have a strong interest in acquiring this asset.",
        "After further internal review and discussions with our investment partners, we would like to formally express our intent to purchase the property, should your company still have an interest in selling.",
        "Before proceeding further, we would appreciate clarification on a few items:",
        "Please confirm your relationship to the property. Is there currently a mortgage in place? If so, what is the maturity date and remaining balance?",
        "If these details are not readily available, we kindly request the most recent financial statements and any supporting documentation. This will allow us to properly evaluate the asset and present a structured and appropriate offer.",
        "We appreciate your time and consideration and look forward to your response.",
        "Sincerely, The Jehoni Kierre Williams Living Trust Jehoni Kierre Williams, Trustee",
        "Email: jehoniwilliams02@gmail.com",
        "Phone: (409) 937-0620",
      ].join("\n\n")
    )
  })

  it("repairs punctuation artifacts left inside common words", () => {
    expect(
      cleanLeadMessageText(
        "After further internal review and discussions wi.th our investment partners, we would like to proceed."
      )
    ).toBe(
      "After further internal review and discussions with our investment partners, we would like to proceed."
    )
  })

  it("returns null for messages that become empty after cleanup", () => {
    expect(
      cleanLeadMessageText(
        "[https://files.crexi.com/email-images/crexi_logo_black.png] <https://email.notifications.crexi.com/c/foo>"
      )
    ).toBeNull()
  })
})
