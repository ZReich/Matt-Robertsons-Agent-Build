import { describe, expect, it } from "vitest"

import type { FilterContext, GraphEmailMessage } from "./email-types"

import {
  JUNK_FOLDER_NAMES,
  classifyEmail,
  hasAutomatedLocalPart,
  hasUnsubscribeHeader,
  isJunkOrDeletedFolder,
  isNoiseDomain,
  isNoiseSenderAddress,
} from "./email-filter"

function ctx(overrides: Partial<FilterContext> = {}): FilterContext {
  return {
    folder: "inbox",
    targetUpn: "mrobertson@naibusinessproperties.com",
    normalizedSender: {
      address: "someone@example.com",
      displayName: "Someone",
      isInternal: false,
      normalizationFailed: false,
    },
    hints: {
      senderInContacts: false,
      mattRepliedBefore: false,
      threadSize: 1,
      domainIsLargeCreBroker: false,
    },
    ...overrides,
  }
}
function msg(o: Partial<GraphEmailMessage> = {}): GraphEmailMessage {
  return {
    id: "m1",
    subject: "",
    from: { emailAddress: { address: "someone@example.com", name: "Someone" } },
    receivedDateTime: "2026-01-01T00:00:00Z",
    toRecipients: [
      { emailAddress: { address: "mrobertson@naibusinessproperties.com" } },
    ],
    ...o,
  }
}

describe("isNoiseDomain", () => {
  it("returns true for domains in the noise list", () => {
    expect(isNoiseDomain("propertyblast.com")).toBe(true)
    expect(isNoiseDomain("flexmail.flexmls.com")).toBe(true)
    expect(isNoiseDomain("e.mail.realtor.com")).toBe(true)
  })
  it("returns true for subdomains of noise domains", () => {
    expect(isNoiseDomain("sub.propertyblast.com")).toBe(true)
  })
  it("returns false for domains NOT in the noise list", () => {
    expect(isNoiseDomain("naibusinessproperties.com")).toBe(false)
    expect(isNoiseDomain("cbre.com")).toBe(false)
    expect(isNoiseDomain("docusign.net")).toBe(false)
  })
  it("is case-insensitive", () => {
    expect(isNoiseDomain("PropertyBlast.com")).toBe(true)
  })
})

describe("isNoiseSenderAddress", () => {
  it("returns true for specific Crexi noise senders", () => {
    expect(isNoiseSenderAddress("emails@pro.crexi.com")).toBe(true)
    expect(isNoiseSenderAddress("emails@search.crexi.com")).toBe(true)
    expect(isNoiseSenderAddress("emails@campaigns.crexi.com")).toBe(true)
    expect(isNoiseSenderAddress("notifications@pro.crexi.com")).toBe(true)
  })
  it("returns true for nlpg@cbre.com but not other cbre senders", () => {
    expect(isNoiseSenderAddress("nlpg@cbre.com")).toBe(true)
    expect(isNoiseSenderAddress("ian.schroeder@cbre.com")).toBe(false)
  })
  it("is case-insensitive", () => {
    expect(isNoiseSenderAddress("Emails@Pro.Crexi.Com")).toBe(true)
  })
})

describe("hasAutomatedLocalPart", () => {
  it("matches common automated prefixes", () => {
    expect(hasAutomatedLocalPart("noreply@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("no-reply@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("news@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("newsletter@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("digest@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("updates@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("marketing@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("alerts@example.com")).toBe(true)
  })
  it("matches with numeric suffixes and plus-tags", () => {
    expect(hasAutomatedLocalPart("news2@example.com")).toBe(true)
    expect(hasAutomatedLocalPart("marketing+promo@example.com")).toBe(true)
  })
  it("does NOT match personal-looking local parts", () => {
    expect(hasAutomatedLocalPart("alice@example.com")).toBe(false)
    expect(hasAutomatedLocalPart("mrobertson@example.com")).toBe(false)
    expect(hasAutomatedLocalPart("john.smith@example.com")).toBe(false)
  })
  it("does NOT match when no @ is present", () => {
    expect(hasAutomatedLocalPart("noreply")).toBe(false)
  })
})

describe("hasUnsubscribeHeader", () => {
  it("returns true when List-Unsubscribe header is present (any case)", () => {
    expect(
      hasUnsubscribeHeader([
        { name: "List-Unsubscribe", value: "<mailto:u@x>" },
      ])
    ).toBe(true)
    expect(
      hasUnsubscribeHeader([
        { name: "list-unsubscribe", value: "<mailto:u@x>" },
      ])
    ).toBe(true)
  })
  it("returns false when absent or headers undefined", () => {
    expect(hasUnsubscribeHeader([])).toBe(false)
    expect(hasUnsubscribeHeader(undefined)).toBe(false)
    expect(hasUnsubscribeHeader([{ name: "Subject", value: "Hi" }])).toBe(false)
  })
})

describe("isJunkOrDeletedFolder", () => {
  it("identifies Junk and Deleted Items folders by well-known IDs", () => {
    for (const name of JUNK_FOLDER_NAMES) {
      expect(isJunkOrDeletedFolder(name)).toBe(true)
    }
  })
  it("returns false for inbox/sentitems", () => {
    expect(isJunkOrDeletedFolder("inbox")).toBe(false)
    expect(isJunkOrDeletedFolder("sentitems")).toBe(false)
    expect(isJunkOrDeletedFolder(undefined)).toBe(false)
  })
})

describe("classifyEmail — Layer A (auto-signal)", () => {
  it("marks sentitems as matt-outbound signal", () => {
    const r = classifyEmail(msg(), ctx({ folder: "sentitems" }))
    expect(r).toMatchObject({
      classification: "signal",
      source: "matt-outbound",
    })
  })

  it("marks NAI internal with Matt in To as nai-internal signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "jsmith@naibusinessproperties.com" } },
      }),
      ctx({
        normalizedSender: {
          address: "jsmith@naibusinessproperties.com",
          displayName: "Jennifer",
          isInternal: true,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "signal",
      source: "nai-internal",
    })
  })

  it("does NOT mark NAI internal as signal when Matt is only in CC", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "jsmith@naibusinessproperties.com" } },
        toRecipients: [{ emailAddress: { address: "other@example.com" } }],
        ccRecipients: [
          { emailAddress: { address: "mrobertson@naibusinessproperties.com" } },
        ],
      }),
      ctx({
        normalizedSender: {
          address: "jsmith@naibusinessproperties.com",
          displayName: "J",
          isInternal: true,
          normalizationFailed: false,
        },
      })
    )
    expect(r.source).not.toBe("nai-internal")
  })

  it("does NOT mark NAI internal as signal when toRecipients has > 10 entries (blast)", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      emailAddress: { address: `u${i}@naibusinessproperties.com` },
    }))
    many.push({
      emailAddress: { address: "mrobertson@naibusinessproperties.com" },
    })
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "data@naibusinessproperties.com" } },
        toRecipients: many,
      }),
      ctx({
        normalizedSender: {
          address: "data@naibusinessproperties.com",
          displayName: "Data",
          isInternal: true,
          normalizationFailed: false,
        },
      })
    )
    expect(r.source).not.toBe("nai-internal")
  })

  it("marks @docusign.net as docusign-transactional signal", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "dse_na2@docusign.net" } } }),
      ctx({
        normalizedSender: {
          address: "dse_na2@docusign.net",
          displayName: "Docusign",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "signal",
      source: "docusign-transactional",
    })
  })

  it("marks Buildout support + lead subject as buildout-event signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "support@buildout.com" } },
        subject: "A new Lead has been added - US Bank Building",
      }),
      ctx({
        normalizedSender: {
          address: "support@buildout.com",
          displayName: "Buildout Support",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "signal",
      source: "buildout-event",
    })
  })

  it("marks LoopNet leads@ + LoopNet-Lead subject as loopnet-lead signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "leads@loopnet.com" } },
        subject: "LoopNet Lead for 303 N Broadway",
      }),
      ctx({
        normalizedSender: {
          address: "leads@loopnet.com",
          displayName: "LoopNet",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "signal",
      source: "loopnet-lead",
    })
  })

  it("marks Crexi notifications + lead subject as crexi-lead signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "emails@notifications.crexi.com" } },
        subject: "3 new leads found for West Park Promenade",
      }),
      ctx({
        normalizedSender: {
          address: "emails@notifications.crexi.com",
          displayName: "Crexi",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({ classification: "signal", source: "crexi-lead" })
  })

  it("does NOT mark Crexi notifications + platform-admin subject as signal", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "emails@notifications.crexi.com" } },
        subject: "Updates have been made to 1 Property you are interested in",
      }),
      ctx({
        normalizedSender: {
          address: "emails@notifications.crexi.com",
          displayName: "Crexi",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r.source).not.toBe("crexi-lead")
  })

  it("marks known counterparty (sender in Contacts + Matt replied) as signal", () => {
    const r = classifyEmail(
      msg(),
      ctx({
        hints: {
          senderInContacts: true,
          mattRepliedBefore: true,
          threadSize: 3,
          domainIsLargeCreBroker: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "signal",
      source: "known-counterparty",
    })
  })
})

describe("classifyEmail — Layer B (hard drop)", () => {
  it("drops messages from a NOISE_DOMAINS domain", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "x@propertyblast.com" } } }),
      ctx({
        normalizedSender: {
          address: "x@propertyblast.com",
          displayName: "Blast",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "noise",
      source: "layer-b-domain-drop",
    })
  })

  it("drops specific noise sender addresses", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "emails@pro.crexi.com" } } }),
      ctx({
        normalizedSender: {
          address: "emails@pro.crexi.com",
          displayName: "Crexi",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "noise",
      source: "layer-b-sender-drop",
    })
  })

  it("drops automated local parts when NOT on the transactional allowlist", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "news@somecompany.com" } } }),
      ctx({
        normalizedSender: {
          address: "news@somecompany.com",
          displayName: "News",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "noise",
      source: "layer-b-local-part-drop",
    })
  })

  it("does NOT drop automated local parts from allowlisted transactional domains", () => {
    const r = classifyEmail(
      msg({ from: { emailAddress: { address: "no-reply@buildout.com" } } }),
      ctx({
        normalizedSender: {
          address: "no-reply@buildout.com",
          displayName: "Buildout",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r.classification).not.toBe("noise")
  })

  it("drops messages with List-Unsubscribe header when not otherwise allowlisted", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "hello@somerandomco.com" } },
        internetMessageHeaders: [
          { name: "List-Unsubscribe", value: "<mailto:u>" },
        ],
      }),
      ctx({
        normalizedSender: {
          address: "hello@somerandomco.com",
          displayName: "Co",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({
      classification: "noise",
      source: "layer-b-unsubscribe-header",
    })
  })

  it("drops messages in Junk Email folder regardless of sender", () => {
    const r = classifyEmail(msg({ parentFolderId: "junkemail" }), ctx())
    expect(r).toMatchObject({
      classification: "noise",
      source: "layer-b-folder-drop",
    })
  })
})

describe("classifyEmail — Layer C (uncertain fallback)", () => {
  it("labels otherwise-unknown senders as uncertain", () => {
    const r = classifyEmail(
      msg({
        from: { emailAddress: { address: "unknown@mystery-co.com" } },
        subject: "Question about your listing",
      }),
      ctx({
        normalizedSender: {
          address: "unknown@mystery-co.com",
          displayName: "Unknown",
          isInternal: false,
          normalizationFailed: false,
        },
      })
    )
    expect(r).toMatchObject({ classification: "uncertain", source: "layer-c" })
  })
})
