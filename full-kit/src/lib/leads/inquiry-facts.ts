import { cleanLeadMessageText } from "./message-text"

export type LeadInquiryFacts = {
  kind: string | null
  platform: string | null
  inquirerName: string | null
  contactEmail: string | null
  contactPhone: string | null
  propertyName: string | null
  address: string | null
  market: string | null
  listingLine: string | null
  request: string | null
  message: string | null
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function extractedRecord(metadata: unknown): JsonRecord | null {
  const record = asRecord(metadata)
  return asRecord(record?.extracted)
}

function normalizeQuestion(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([?!.:,;])/g, "$1")
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function titleCaseName(value: string | null): string | null {
  if (!value || value.includes("@")) return value
  return value
    .split(/\s+/)
    .map((part) =>
      part.length <= 2
        ? part.toUpperCase()
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join(" ")
}

function extractContactEmail(raw: string | null): string | null {
  if (!raw) return null
  const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []
  return (
    matches.find(
      (email) =>
        !email.toLowerCase().includes("support@") &&
        !email.toLowerCase().includes("notifications.")
    ) ?? null
  )
}

function normalizePhone(value: string): string {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    decoded = value
  }

  const digits = decoded.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return decoded.replace(/\s+/g, " ").trim()
}

function extractContactPhone(raw: string | null): string | null {
  if (!raw) return null
  const withoutUrls = raw.replace(/https?:\/\/\S+/gi, " ")
  const labeled = withoutUrls.match(
    /(?:phone\]|phone:|tel:)\s*([+()\d][+()\d\s.%-]{7,}\d)/i
  )
  const fallback = withoutUrls.match(/\+?\d[\d\s().-]{7,}\d/)
  const value = labeled?.[1] ?? fallback?.[0]
  return value ? normalizePhone(value) : null
}

function extractListingLine(message: string | null): string | null {
  if (!message) return null

  const compact = message.replace(/\s+/g, " ").trim()
  const match = compact.match(
    /\bRegarding listing at\s+(.+?)(?=\s+(?:Is this|Can you|Could you|Please|Thank you|I would|I'm|I am)\b|$)/i
  )

  return match?.[1] ? normalizeQuestion(match[1]) : null
}

function extractAddressFacts(
  message: string | null,
  propertyName: string | null
): { address: string | null; market: string | null } {
  if (!message) return { address: null, market: null }

  const clean = message.replace(/\s+/g, " ").trim()
  const cityStateZip = /([A-Z][A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})/
  if (propertyName) {
    const propertyAddressMatch = clean.match(
      new RegExp(
        `${escapeRegExp(propertyName)}\\s+([A-Z][A-Za-z .'-]+),\\s*([A-Z]{2})\\s+(\\d{5})`
      )
    )
    if (propertyAddressMatch?.[1]) {
      const cityState = `${propertyAddressMatch[1].trim()}, ${propertyAddressMatch[2]} ${propertyAddressMatch[3]}`
      return {
        address: `${propertyName}, ${cityState}`,
        market: propertyAddressMatch[1].trim(),
      }
    }
  }

  const cityMatch = clean.match(cityStateZip)
  const market = cityMatch?.[1]?.trim() ?? null

  if (propertyName && cityMatch?.index !== undefined) {
    const beforeCity = clean.slice(0, cityMatch.index).trim()
    const propertyIndex = beforeCity.lastIndexOf(propertyName)
    if (propertyIndex >= 0) {
      return {
        address: `${propertyName}, ${cityMatch[0]}`,
        market,
      }
    }
  }

  const listingLine = extractListingLine(message)
  if (listingLine) {
    return {
      address: listingLine,
      market: listingLine.match(cityStateZip)?.[1]?.trim() ?? market,
    }
  }

  return { address: null, market }
}

function extractRequest(
  message: string | null,
  kind: string | null,
  inquirerName: string | null,
  propertyName: string | null
): string | null {
  if (kind === "favorited") {
    return `${inquirerName ?? "Someone"} favorited ${propertyName ?? "this property"}.`
  }

  if (!message) return null

  const clean = message.replace(/\s+/g, " ").trim()
  const questions = clean
    .match(/[^?]+\?/g)
    ?.map(normalizeQuestion)
    .filter(Boolean)
  const question =
    questions?.find((item) => !/^Regarding listing\b/i.test(item)) ??
    questions?.[0]
  if (question) {
    return normalizeQuestion(
      question.replace(
        /^Regarding listing at\s+.+?\s+(?=Is this|Can you|Could you)/i,
        ""
      )
    )
  }

  const interest = clean.match(
    /\b((?:I am|I'm|We are|We're|I would|We would|Please|Can you|Could you)\b.+?)(?:Thank you|Sincerely|$)/i
  )
  if (interest?.[1]) return normalizeQuestion(interest[1])

  return null
}

function messageForBrief(
  message: string | null,
  request: string | null,
  kind: string | null
): string | null {
  if (!message || kind === "favorited") return null

  const paragraphs = message.split(/\n{2,}/).filter(Boolean)
  const unique = paragraphs.filter(
    (paragraph) => paragraph.trim() !== request?.trim()
  )

  return unique.length > 0 ? unique.join("\n\n") : null
}

export function extractLeadInquiryFacts(
  metadata: unknown,
  fallbackMessage: string | null,
  fallbackSubject: string | null = null
): LeadInquiryFacts {
  const extracted = extractedRecord(metadata)
  const message = cleanLeadMessageText(fallbackMessage)
  const kind = stringValue(extracted?.kind)
  const platform = stringValue(extracted?.platform)
  const inquirerName = titleCaseName(
    stringValue(extracted?.inquirerName) ??
      stringValue(extracted?.viewerName) ??
      stringValue(asRecord(asRecord(metadata)?.from)?.displayName)
  )
  const contactEmail = extractContactEmail(fallbackMessage)
  const contactPhone = extractContactPhone(fallbackMessage)
  const propertyName = stringValue(extracted?.propertyName)
  const listingLine = extractListingLine(message)
  const addressFacts = extractAddressFacts(message, propertyName)
  const market =
    stringValue(extracted?.cityOrMarket) ??
    stringValue(extracted?.market) ??
    addressFacts.market
  const request =
    extractRequest(message, kind, inquirerName, propertyName) ??
    cleanLeadMessageText(fallbackSubject)

  return {
    kind,
    platform,
    inquirerName,
    contactEmail,
    contactPhone,
    propertyName,
    address: addressFacts.address,
    market,
    listingLine,
    request,
    message: messageForBrief(message, request, kind),
  }
}
