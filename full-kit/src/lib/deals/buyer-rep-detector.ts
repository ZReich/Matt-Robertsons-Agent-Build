import type { DealStage } from "@prisma/client"

const KNOWN_BROKER_DOMAINS = new Set([
  "cushwake.com",
  "cushmanwakefield.com",
  "jll.com",
  "colliers.com",
  "cbre.com",
  "marcusmillichap.com",
  "newmark.com",
  "kwcommercial.com",
  "sior.com",
  "sperrycga.com",
])

const NAI_DOMAINS = new Set(["naibusinessproperties.com"])

const TOUR_PATTERNS = [
  /\b(tour|showing|walk[\s-]?through)\b/i,
  /\b(schedule|available|time slot)\b/i,
]

const LOI_PATTERNS = [
  /\bLOI\b/,
  /\bletter of intent\b/i,
  /\boffer (sheet|draft)\b/i,
]

// Phase D step 2: NDA detection. Word-boundary on bare "NDA" to avoid false
// positives on "panda", "Ndabaningi", etc. The other phrases are unique
// enough that case-insensitive substring matching is safe.
const NDA_PATTERNS = [
  /\bNDA\b/,
  /\bnon[\s-]?disclosure agreement\b/i,
  /\bconfidentiality agreement\b/i,
]

// Phase D step 2: tenant-rep search activation. Lowest-confidence signal —
// we want to be conservative. The "looking for" pattern is anchored on
// concrete property-type vocabulary so a generic "looking for feedback"
// doesn't trip it. "Searching for" is intentionally narrower than
// "looking for" — it's a stronger market-search verb.
const TENANT_REP_PATTERNS = [
  /\bin the market for\b/i,
  /\blooking for (a |an |the )?(space|properties|property|industrial|warehouse|retail|office|land|building|sites?)\b/i,
  /\bexploring (options|sites|properties|properties for)\b/i,
  /\bsearching for (a |an |the )?(space|properties|property|industrial|warehouse|retail|office|land|building|sites?)\b/i,
]

export function isExternalBrokerDomain(emailOrDomain: string): boolean {
  const lower = emailOrDomain.toLowerCase()
  const domain = lower.includes("@") ? lower.split("@")[1] : lower
  if (NAI_DOMAINS.has(domain)) return false
  if (KNOWN_BROKER_DOMAINS.has(domain)) return true
  return false
}

export type BuyerRepSignalInput = {
  direction: "inbound" | "outbound"
  subject: string
  body: string
  recipientDomains: string[]
}

export type BuyerRepSignalType = "tour" | "loi" | "nda" | "tenant_rep_search"

export type BuyerRepSignalResult = {
  signalType: BuyerRepSignalType | null
  proposedStage: DealStage | null
  confidence: number
}

export function classifyBuyerRepSignal(
  input: BuyerRepSignalInput
): BuyerRepSignalResult {
  if (input.direction !== "outbound") {
    return { signalType: null, proposedStage: null, confidence: 0 }
  }
  const allInternal = input.recipientDomains.every((d) =>
    NAI_DOMAINS.has(d.toLowerCase())
  )
  if (allInternal || input.recipientDomains.length === 0) {
    return { signalType: null, proposedStage: null, confidence: 0 }
  }

  const text = `${input.subject}\n${input.body}`

  // Precedence (DESC by confidence): LOI > tour > NDA > tenant_rep_search.
  // First match wins per email; we never multi-fire on a single message.
  if (LOI_PATTERNS.some((re) => re.test(text))) {
    return { signalType: "loi", proposedStage: "offer", confidence: 0.85 }
  }
  if (TOUR_PATTERNS[0].test(text) && TOUR_PATTERNS[1].test(text)) {
    return { signalType: "tour", proposedStage: "showings", confidence: 0.75 }
  }

  // NDA + tenant_rep are gated on at-least-one-external-BROKER recipient
  // (not just any non-NAI recipient). They're lower-confidence so we
  // require the stronger domain signal to fire at all.
  const hasExternalBroker = input.recipientDomains.some((d) =>
    isExternalBrokerDomain(d)
  )
  if (!hasExternalBroker) {
    return { signalType: null, proposedStage: null, confidence: 0 }
  }

  if (NDA_PATTERNS.some((re) => re.test(text))) {
    return { signalType: "nda", proposedStage: "prospecting", confidence: 0.7 }
  }
  if (TENANT_REP_PATTERNS.some((re) => re.test(text))) {
    return {
      signalType: "tenant_rep_search",
      proposedStage: "prospecting",
      confidence: 0.5,
    }
  }
  return { signalType: null, proposedStage: null, confidence: 0 }
}
