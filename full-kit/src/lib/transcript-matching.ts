/**
 * Server-safe utility for matching Plaud call transcripts to meetings.
 * Separated from the ActivityTimeline client component to avoid RSC boundary violations.
 */

import type { CommunicationMeta, MeetingMeta, VaultNote } from "@/lib/vault"

import { normalizeEntityRef } from "@/lib/vault"

export interface TranscriptMatch {
  transcript: VaultNote<CommunicationMeta>
  confidence: "explicit" | "high" | "medium"
}

/**
 * Match Plaud call transcripts to meetings by contact + time proximity.
 *
 * Confidence levels:
 * - "high": same contact, channel=call, dates within 15 minutes
 * - "medium": same contact, channel=call, dates within 60 minutes
 * - Ambiguous (multiple matches in window): skipped entirely
 *
 * Returns a plain object (not a Map) for RSC serialization safety.
 */
export function matchTranscriptsToMeetings(
  comms: VaultNote<CommunicationMeta>[],
  meetings: VaultNote<MeetingMeta>[]
): Record<string, TranscriptMatch> {
  const matches: Record<string, TranscriptMatch> = {}

  const callComms = comms.filter((c) => c.meta.channel === "call")

  for (const meeting of meetings) {
    const meetingContact = meeting.meta.contact
      ? normalizeEntityRef(meeting.meta.contact)
      : null
    if (!meetingContact) continue

    const meetingTime = new Date(meeting.meta.date).getTime()
    if (Number.isNaN(meetingTime)) continue

    // Find matching calls within 60-minute window
    const candidates = callComms
      .filter((c) => {
        const commContact = normalizeEntityRef(c.meta.contact)
        if (commContact !== meetingContact) return false
        const commTime = new Date(c.meta.date).getTime()
        if (Number.isNaN(commTime)) return false
        return Math.abs(commTime - meetingTime) < 60 * 60 * 1000
      })
      .sort(
        (a, b) =>
          Math.abs(new Date(a.meta.date).getTime() - meetingTime) -
          Math.abs(new Date(b.meta.date).getTime() - meetingTime)
      )

    // Only match when there's exactly one candidate (skip ambiguous)
    if (candidates.length === 1) {
      const timeDiff = Math.abs(
        new Date(candidates[0].meta.date).getTime() - meetingTime
      )
      matches[meeting.path] = {
        transcript: candidates[0],
        confidence: timeDiff < 15 * 60 * 1000 ? "high" : "medium",
      }
    }
  }

  return matches
}
