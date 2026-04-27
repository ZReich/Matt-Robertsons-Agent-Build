export type NormalizedProperty = {
  propertyNameRaw: string
  propertyAddressRaw?: string
  normalizedPropertyKey: string
  unitOrSuite?: string
  aliases: string[]
  addressMissing: boolean
  confidence: number
  normalizationReason: string
}

const ROAD_SUFFIXES: Array<[RegExp, string]> = [
  [/\bavenue\b/g, "ave"],
  [/\bstreet\b/g, "st"],
  [/\broad\b/g, "rd"],
  [/\bboulevard\b/g, "blvd"],
  [/\bdrive\b/g, "dr"],
  [/\bnorth\b/g, "n"],
  [/\bsouth\b/g, "s"],
  [/\beast\b/g, "e"],
  [/\bwest\b/g, "w"],
]

const ADDRESS_PATTERN =
  /\b\d{1,6}\s+[a-z0-9.'-]+(?:\s+(?!\d{1,2}\s+[A-Z]{3}\b|at\b|on\b|view\b|viewed\b)[a-z0-9.'-]+){0,5}\b/i
const SUITE_PATTERN = /(?:\b(?:suite|ste|unit)\s+[a-z0-9-]+|#\s*[a-z0-9-]+)\b/i

export function normalizeBuildoutProperty(
  raw: string | null | undefined,
  bodyText = ""
): NormalizedProperty | null {
  const propertyNameRaw = cleanRaw(raw)
  if (!propertyNameRaw) return null

  const aliases = new Set<string>([propertyNameRaw])
  const combined = `${propertyNameRaw} ${bodyText}`
  const bodyAddress = firstAddress(bodyText)
  const rawAddress = firstAddress(propertyNameRaw)
  const propertyAddressRaw = bodyAddress ?? rawAddress
  let unitOrSuite = extractSuite(propertyNameRaw) ?? extractSuite(bodyText)

  let keySource = propertyNameRaw
  let reason = "name-key"
  let confidence = 0.7

  if (propertyAddressRaw) {
    keySource = propertyAddressRaw
    reason = bodyAddress ? "body-address-key" : "raw-address-key"
    confidence = bodyAddress ? 0.95 : 0.9
  } else {
    const nicknameAddress = propertyNameRaw.match(
      /^(.*?)\s*-\s*(\d{1,6}\s+.+)$/
    )
    if (nicknameAddress) {
      aliases.add(nicknameAddress[1].trim())
      keySource = nicknameAddress[2].trim()
      reason = "nickname-address-key"
      confidence = 0.9
    }
  }

  const pipeParts = propertyNameRaw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
  if (!propertyAddressRaw && pipeParts.length > 1) {
    const suitePart = pipeParts.find((part) => SUITE_PATTERN.test(part))
    unitOrSuite ??= suitePart ? normalizeSuite(suitePart) : undefined
    if (suitePart) {
      keySource = pipeParts[0]
      reason = "pipe-suite-key"
      confidence = 0.8
    }
  }

  const normalizedPropertyKey = normalizeKey(stripSuite(keySource))
  if (!normalizedPropertyKey) return null

  const addressMissing = !/^\d/.test(normalizedPropertyKey)
  if (addressMissing && confidence > 0.75) confidence = 0.75

  for (const alias of deriveAliases(propertyNameRaw, propertyAddressRaw)) {
    if (alias) aliases.add(alias)
  }

  // Keep the variable referenced for future parser expansion and to make the
  // intent explicit: both subject and body participate in normalization.
  void combined

  return {
    propertyNameRaw,
    ...(propertyAddressRaw ? { propertyAddressRaw } : {}),
    normalizedPropertyKey,
    ...(unitOrSuite ? { unitOrSuite } : {}),
    aliases: [...aliases],
    addressMissing,
    confidence,
    normalizationReason: reason,
  }
}

function cleanRaw(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*\.\s*$/g, "")
    .replace(/\s+$/g, "")
    .trim()
}

function normalizeKey(value: string): string {
  let key = cleanRaw(value)
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/[|]/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  for (const [pattern, replacement] of ROAD_SUFFIXES) {
    key = key.replace(pattern, replacement)
  }
  return key.replace(/\s+/g, " ").trim()
}

function stripSuite(value: string): string {
  return value
    .replace(SUITE_PATTERN, "")
    .replace(/\s+[-|]\s*$/g, "")
    .trim()
}

function extractSuite(value: string): string | undefined {
  const match = value.match(SUITE_PATTERN)
  return match ? normalizeSuite(match[0]) : undefined
}

function normalizeSuite(value: string): string {
  return value
    .toLowerCase()
    .replace(/^ste\b/, "suite")
    .replace(/^#\s*/, "suite ")
    .replace(/\s+/g, " ")
    .trim()
}

function firstAddress(value: string): string | undefined {
  const cleaned = cleanRaw(value)
  const viewedForMatch = cleaned.match(/\bfor\s+(\d{1,6}\s+.+?)\s+at\s+/i)
  if (viewedForMatch) return viewedForMatch[1].trim()
  const match = cleaned.match(ADDRESS_PATTERN)
  return match?.[0]?.trim()
}

function deriveAliases(raw: string, address: string | undefined): string[] {
  const aliases: string[] = []
  const nicknameAddress = raw.match(/^(.*?)\s*-\s*(\d{1,6}\s+.+)$/)
  if (nicknameAddress) aliases.push(nicknameAddress[1].trim())
  if (address && raw !== address) aliases.push(raw)
  return aliases
}
