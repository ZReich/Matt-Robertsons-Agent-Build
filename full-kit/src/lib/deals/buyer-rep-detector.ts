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

export type BuyerRepSignalResult = {
  signalType: "tour" | "loi" | null
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
  if (LOI_PATTERNS.some((re) => re.test(text))) {
    return { signalType: "loi", proposedStage: "offer", confidence: 0.85 }
  }
  if (TOUR_PATTERNS[0].test(text) && TOUR_PATTERNS[1].test(text)) {
    return { signalType: "tour", proposedStage: "showings", confidence: 0.75 }
  }
  return { signalType: null, proposedStage: null, confidence: 0 }
}
