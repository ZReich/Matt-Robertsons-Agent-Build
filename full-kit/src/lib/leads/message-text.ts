const BASIC_ENTITIES: Record<string, string> = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
  apos: "'",
}

const SECTION_STARTS = [
  "Dear ",
  "My name is",
  "I am reaching out",
  "After further",
  "Before proceeding",
  "Please confirm",
  "If these details",
  "We appreciate",
  "Thank you",
  "Sincerely,",
  "Email:",
  "Phone:",
  "Regarding listing",
  "Is this",
  "Can you",
  "Could you",
  "I would",
  "I am interested",
]

function decodeEntities(value: string): string {
  return value.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, body) => {
    const key = body.toLowerCase()
    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : entity
    }
    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(codePoint)
        ? String.fromCodePoint(codePoint)
        : entity
    }
    return BASIC_ENTITIES[key] ?? entity
  })
}

function removeFooterContent(value: string): string {
  return value
    .replace(/\bWant to receive this message as a text\s*\??[\s\S]*$/i, "")
    .replace(/\bIs this email helpful\?[\s\S]*$/i, "")
    .replace(
      /\bMake sure your listing information is up to date\.[\s\S]*$/i,
      ""
    )
    .replace(/\bsupport@crexi\.com[\s\S]*$/i, "")
    .replace(/\b©\s*\d{4}\s+CoStar Group[\s\S]*$/i, "")
    .replace(/\b©\s*\d{4}\s+Commercial Real Estate Exchange[\s\S]*$/i, "")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= 420) return [paragraph]

  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/g).filter(Boolean)

  if (sentences.length <= 1) return [paragraph]

  const chunks: string[] = []
  let current = ""

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence
    if (current && next.length > 320) {
      chunks.push(current)
      current = sentence
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)

  return chunks
}

function formatMessageChunks(value: string): string {
  let chunked = value.replace(/\s+/g, " ").trim()

  for (const start of SECTION_STARTS) {
    chunked = chunked.replace(
      new RegExp(`\\s+(${escapeRegExp(start)})`, "g"),
      "\n\n$1"
    )
  }

  return chunked
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph)
    .map((paragraph) => paragraph.trim())
    .join("\n\n")
}

function repairCleanupArtifacts(value: string): string {
  return value.replace(/\bwi\s*[.]\s*th\b/gi, "with")
}

export function cleanLeadMessageText(
  value: string | null | undefined
): string | null {
  if (!value) return null

  const withoutLinks = removeFooterContent(decodeEntities(value))
    .replace(/<tel:([^>]+)>/gi, " ")
    .replace(/<https?:\/\/[\s\S]*?>/gi, " ")
    .replace(/<mailto:[^>]*>/gi, " ")
    .replace(/!?\[(?:https?|mailto):[^\]]*\]/gi, " ")
    .replace(/\[(?:https?|data):[^\]]*\]/gi, " ")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\btel:\S+/gi, " ")
    .replace(/\bmailto:\S+/gi, " ")
    .replace(/\[(Email|Phone|Contact|Website)\]/gi, " ")
    .replace(/\[(LoopNet|Crexi)\]/gi, "$1")
    .replace(/\bView Listing Report\b\s*_+/gi, "")
    .replace(/\bView My Leads\b/gi, "")
    .replace(/\bReply\b/gi, " ")
    .replace(/[<>]/g, " ")

  const cleaned = formatMessageChunks(
    repairCleanupArtifacts(
      withoutLinks
        .split(/\r?\n/)
        .map((line) =>
          line
            .replace(/^[\s"']+|[\s"']+$/g, "")
            .replace(/\s{2,}/g, " ")
            .replace(/\s+([,.;:!?])/g, "$1")
            .trim()
        )
        .filter(Boolean)
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim()
    )
  )

  return cleaned.length > 0 ? cleaned : null
}
