import { NextResponse } from "next/server"

import { authenticateUser } from "@/lib/auth"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
} from "@/lib/reviewer-auth"

export async function requireApiUser(): Promise<Response | null> {
  try {
    await authenticateUser()
    return null
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
}

export function validateJsonMutationRequest(request: Request): Response | null {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    return null
  } catch (error) {
    const status = error instanceof ReviewerAuthError ? error.status : 403
    const message =
      error instanceof Error && error.message
        ? error.message
        : "invalid request"
    return NextResponse.json({ error: message }, { status })
  }
}
