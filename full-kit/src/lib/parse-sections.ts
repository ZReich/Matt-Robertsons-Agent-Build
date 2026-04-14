/**
 * Parse structured sections from markdown content.
 *
 * Extracts key takeaways, action items, and other sections from
 * vault communication notes that follow a consistent ## heading structure.
 *
 * Example input:
 *   ## PLAUD Transcript Summary
 *   John called to discuss the inspection...
 *   ## Action Items
 *   - [ ] Confirm inspection time
 *   - [x] Send Phase I report
 */

export interface ActionItem {
  text: string
  completed: boolean
}

export interface ParsedSections {
  /** Summary / key takeaways (text under ## Summary, ## PLAUD Transcript Summary, ## Key Takeaways) */
  summary: string | null
  /** Extracted action items with completion status */
  actionItems: ActionItem[]
  /** All named sections as { heading, content } pairs */
  sections: { heading: string; content: string }[]
  /** Content that doesn't belong to a recognized section */
  remainingContent: string
}

/** Heading name patterns that indicate a summary/takeaways section */
const SUMMARY_PATTERNS = [
  /^(plaud\s+transcript\s+summary|summary|key\s+takeaways|takeaways|highlights|overview)$/i,
]

/** Heading name patterns that indicate an action items section */
const ACTION_ITEM_PATTERNS = [
  /^(action\s+items|action\s+points|next\s+steps|follow[- ]?ups?|to[- ]?do)$/i,
]

/** Regex to match a checkbox list item: - [ ] text or - [x] text */
const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.+)$/

/**
 * Parse markdown content into structured sections.
 */
export function parseSections(markdown: string): ParsedSections {
  if (!markdown?.trim()) {
    return { summary: null, actionItems: [], sections: [], remainingContent: "" }
  }

  const lines = markdown.split("\n")
  const sections: { heading: string; content: string }[] = []
  let currentHeading: string | null = null
  let currentLines: string[] = []
  const preambleLines: string[] = []

  for (const line of lines) {
    // Only treat ## (h2) as a section boundary.
    // ### and deeper headings are nested content within their parent section.
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      // Save previous section
      if (currentHeading !== null) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join("\n").trim(),
        })
      }
      currentHeading = line.replace(/^##\s+/, "").trim()
      currentLines = []
    } else if (currentHeading !== null) {
      currentLines.push(line)
    } else {
      // Lines before the first heading
      preambleLines.push(line)
    }
  }

  // Save last section
  if (currentHeading !== null) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join("\n").trim(),
    })
  }

  // Find the summary section
  let summary: string | null = null
  const summaryIdx = sections.findIndex((s) =>
    SUMMARY_PATTERNS.some((p) => p.test(s.heading))
  )
  if (summaryIdx !== -1) {
    summary = sections[summaryIdx].content
  }

  // Find action items section and extract checkboxes
  const actionItems: ActionItem[] = []
  const actionIdx = sections.findIndex((s) =>
    ACTION_ITEM_PATTERNS.some((p) => p.test(s.heading))
  )
  if (actionIdx !== -1) {
    const actionContent = sections[actionIdx].content
    for (const line of actionContent.split("\n")) {
      const match = line.trim().match(CHECKBOX_RE)
      if (match) {
        actionItems.push({
          text: match[2].trim(),
          completed: match[1].toLowerCase() === "x",
        })
      } else if (/^[-*]\s+/.test(line.trim())) {
        // Plain bullet (no checkbox) — treat as incomplete item
        actionItems.push({
          text: line.trim().replace(/^[-*]\s+/, ""),
          completed: false,
        })
      }
    }
  }

  // Remaining content: preamble + sections that aren't summary or action items
  const otherSections = sections.filter(
    (_, i) => i !== summaryIdx && i !== actionIdx
  )
  const remainingParts = [
    preambleLines.join("\n").trim(),
    ...otherSections.map((s) => `## ${s.heading}\n\n${s.content}`),
  ].filter(Boolean)

  return {
    summary,
    actionItems,
    sections,
    remainingContent: remainingParts.join("\n\n").trim(),
  }
}
