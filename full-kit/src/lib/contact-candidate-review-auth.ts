import { getSession } from "@/lib/auth"

export class CandidateReviewAuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401
  ) {
    super(message)
  }
}

export type CandidateReviewer = {
  id: string
  label: string
}

export async function requireContactCandidateReviewer(): Promise<CandidateReviewer> {
  const session = await getSession()
  if (!session?.user?.id) {
    throw new CandidateReviewAuthError("unauthorized", 401)
  }

  if (!isConfiguredReviewer(session.user.id, session.user.email)) {
    throw new CandidateReviewAuthError("forbidden", 403)
  }

  return {
    id: session.user.id,
    label: session.user.name || session.user.email || `user:${session.user.id}`,
  }
}

export function assertSameOriginRequest(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin) {
    throw new CandidateReviewAuthError("invalid origin", 403)
  }

  const allowedOrigins = new Set<string>([new URL(request.url).origin])
  addConfiguredOrigin(allowedOrigins, process.env.NEXTAUTH_URL)
  addConfiguredOrigin(allowedOrigins, process.env.APP_URL)

  if (!allowedOrigins.has(origin)) {
    throw new CandidateReviewAuthError("invalid origin", 403)
  }
}

function addConfiguredOrigin(origins: Set<string>, value: string | undefined) {
  if (!value) return
  try {
    origins.add(new URL(value).origin)
  } catch {
    // Ignore malformed local config; request origin remains the fallback.
  }
}

function isConfiguredReviewer(id: string, email: string | null | undefined) {
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
