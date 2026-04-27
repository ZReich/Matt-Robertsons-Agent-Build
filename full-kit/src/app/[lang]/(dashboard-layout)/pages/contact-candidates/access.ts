import { redirect } from "next/navigation"

import {
  CandidateReviewAuthError,
  requireContactCandidateReviewer,
} from "@/lib/contact-candidate-review-auth"

export function contactCandidateSignInUrl(lang: string) {
  return `/${lang}/sign-in?redirectTo=${encodeURIComponent(
    `/${lang}/pages/contact-candidates`
  )}`
}

export async function resolveContactCandidatePageAccess(lang: string) {
  try {
    await requireContactCandidateReviewer()
    return { allowed: true } as const
  } catch (error) {
    if (!(error instanceof CandidateReviewAuthError)) throw error
    if (error.status === 401) redirect(contactCandidateSignInUrl(lang))
    return { allowed: false } as const
  }
}
