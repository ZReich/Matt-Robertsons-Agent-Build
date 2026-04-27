import { getSession } from "@/lib/auth"
import {
  ReviewerAuthError,
  assertSameOriginRequest as assertAgentSameOriginRequest,
} from "@/lib/reviewer-auth"

export class CandidateReviewAuthError extends ReviewerAuthError {}

export type CandidateReviewer = {
  id: string
  label: string
}

export async function requireContactCandidateReviewer(): Promise<CandidateReviewer> {
  const session = await getSession()
  if (!session?.user?.id) {
    throw new CandidateReviewAuthError("unauthorized", 401)
  }

  if (!isContactCandidateReviewer(session.user.id, session.user.email)) {
    throw new CandidateReviewAuthError("forbidden", 403)
  }

  return {
    id: session.user.id,
    label: session.user.name || session.user.email || `user:${session.user.id}`,
  }
}

export function assertSameOriginRequest(request: Request): void {
  try {
    assertAgentSameOriginRequest(request)
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      throw new CandidateReviewAuthError(error.message, error.status)
    }
    throw error
  }
}

function isContactCandidateReviewer(
  id: string,
  email: string | null | undefined
) {
  const reviewerIds = csvSet(process.env.CONTACT_CANDIDATE_REVIEWER_IDS)
  const reviewerEmails = csvSet(
    process.env.CONTACT_CANDIDATE_REVIEWER_EMAILS,
    true
  )
  if (reviewerIds.size === 0 && reviewerEmails.size === 0) return false

  if (reviewerIds.has(id.trim())) return true
  if (email && reviewerEmails.has(email.trim().toLowerCase())) return true
  return false
}

function csvSet(value: string | undefined, lowercase = false) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (lowercase ? item.toLowerCase() : item))
  )
}
