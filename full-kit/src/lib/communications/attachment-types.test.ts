import { describe, expect, it } from "vitest"

import { formatAttachmentSize, getAttachmentSummary } from "./attachment-types"

describe("attachment metadata normalization", () => {
  it("returns empty summaries for missing or malformed metadata", () => {
    expect(getAttachmentSummary(undefined).items).toEqual([])
    expect(getAttachmentSummary(null).items).toEqual([])
    expect(getAttachmentSummary({ attachments: "bad" }).items).toEqual([])
  })

  it("normalizes valid Graph-shaped attachments and fetch status", () => {
    const summary = getAttachmentSummary({
      attachmentFetch: { status: "success" },
      attachments: [
        {
          id: "1",
          name: " Lease.pdf ",
          size: 2048,
          contentType: "application/pdf",
        },
      ],
    })

    expect(summary).toMatchObject({
      fetchStatus: "success",
      remaining: 0,
      inlineFilteredCount: 0,
      items: [
        {
          name: "Lease.pdf",
          contentType: "application/pdf",
          category: "pdf",
          size: 2048,
          displaySize: "2 KB",
        },
      ],
    })
  })

  it("filters inline attachments by default and counts remaining non-inline items", () => {
    const summary = getAttachmentSummary(
      {
        attachments: [
          { name: "image001.png", contentType: "image/png", isInline: true },
          { name: "Phase I.pdf", contentType: "application/pdf" },
          {
            name: "PSA.docx",
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        ],
      },
      { limit: 1 }
    )

    expect(summary.inlineFilteredCount).toBe(1)
    expect(summary.items.map((item) => item.name)).toEqual(["Phase I.pdf"])
    expect(summary.remaining).toBe(1)
  })

  it("clamps options, truncates names, and omits invalid sizes", () => {
    const longName = `${"a".repeat(40)}.txt`
    const summary = getAttachmentSummary(
      { attachments: [{ name: longName, contentType: "bad", size: -1 }] },
      { limit: 100, maxNameLength: 16 }
    )

    expect(summary.items).toHaveLength(1)
    expect(summary.items[0]?.name).toHaveLength(16)
    expect(summary.items[0]?.contentType).toBe("application/octet-stream")
    expect(summary.items[0]?.size).toBeUndefined()
    expect(summary.items[0]?.displaySize).toBeUndefined()
  })

  it("tracks oversized raw arrays without inspecting past the cap", () => {
    const summary = getAttachmentSummary(
      {
        attachments: [
          { name: "one.pdf", contentType: "application/pdf" },
          { name: "two.pdf", contentType: "application/pdf" },
        ],
      },
      { maxItemsToInspect: 1 }
    )

    expect(summary.items.map((item) => item.name)).toEqual(["one.pdf"])
    expect(summary.truncatedRawCount).toBe(1)
  })

  it("maps categories by MIME and extension precedence", () => {
    const summary = getAttachmentSummary(
      {
        attachments: [
          { name: "lease.doc", contentType: "application/octet-stream" },
          { name: "rent.xlsx", contentType: "application/octet-stream" },
          { name: "deck.pptx", contentType: "application/octet-stream" },
          { name: "photos.zip", contentType: "application/octet-stream" },
          { name: "note.md", contentType: "application/octet-stream" },
          { name: "thread.eml", contentType: "application/octet-stream" },
        ],
      },
      { limit: 6 }
    )

    expect(summary.items.map((item) => item.category)).toEqual([
      "document",
      "spreadsheet",
      "presentation",
      "archive",
      "text",
      "email",
    ])
  })

  it("formats attachment sizes at documented boundaries", () => {
    expect(formatAttachmentSize(0)).toBe("0 B")
    expect(formatAttachmentSize(999)).toBe("999 B")
    expect(formatAttachmentSize(1024)).toBe("1 KB")
    expect(formatAttachmentSize(1536)).toBe("1.5 KB")
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2 MB")
    expect(formatAttachmentSize(3.2 * 1024 * 1024 * 1024)).toBe("3.2 GB")
    expect(formatAttachmentSize(-1)).toBeUndefined()
  })
})
