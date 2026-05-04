export interface ClientCandidate {
  id: string
  email: string | null
}

export interface ConflictInput {
  recipientEmails: string[]
  candidateClientContacts: ClientCandidate[]
  targetContactId: string
}

export interface ConflictResult {
  matchedContactIds: string[]
  primaryContactId: string
}

export function detectMultiClientConflict(
  input: ConflictInput
): ConflictResult | null {
  const lowered = new Set(input.recipientEmails.map((e) => e.toLowerCase()))
  const matched = input.candidateClientContacts
    .filter((c) => c.email && lowered.has(c.email.toLowerCase()))
    .map((c) => c.id)
    .sort()

  if (matched.length < 2) return null
  return { matchedContactIds: matched, primaryContactId: matched[0] }
}
