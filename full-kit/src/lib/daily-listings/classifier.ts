/**
 * Identifies whether a Communication is a Daily Listings digest from Ty.
 *
 * Sender check is the strong signal — `data@naibusinessproperties.com` is an
 * internal NAI mailbox, never used for anything other than these digests.
 * Subject check is a sanity belt-and-suspenders.
 */

export const DAILY_LISTINGS_SENDER = "data@naibusinessproperties.com"

interface MetadataLike {
  from?: { address?: string }
}

export function isDailyListingsEmail(input: {
  subject: string | null | undefined
  metadata: unknown
}): boolean {
  const subject = (input.subject ?? "").trim().toLowerCase()
  const subjectMatch =
    subject === "daily listings" || subject.startsWith("daily listings ")
  if (!subjectMatch) return false

  const meta = input.metadata as MetadataLike | null
  const senderAddr = meta?.from?.address?.toLowerCase() ?? ""
  if (senderAddr === DAILY_LISTINGS_SENDER) return true

  // If the sender field is missing/garbled, fall back to subject-only match
  // — better to over-classify by 1-2 a year than miss a valid digest.
  return senderAddr === ""
}
