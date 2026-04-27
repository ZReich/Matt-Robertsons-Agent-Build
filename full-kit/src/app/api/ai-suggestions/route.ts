import { NextResponse } from "next/server"

import { getAiSuggestionState } from "@/lib/ai/suggestions"
import { ReviewerAuthError, requireAgentReviewer } from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAgentReviewer()
  } catch (error) {
    if (error instanceof ReviewerAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    throw error
  }

  const url = new URL(request.url)
  const entityType = url.searchParams.get("entityType")
  const entityId = url.searchParams.get("entityId")
  const surface = url.searchParams.get("surface")

  if (
    !entityId ||
    (entityType !== "contact" &&
      entityType !== "deal" &&
      entityType !== "communication")
  ) {
    return NextResponse.json({ error: "invalid entity" }, { status: 400 })
  }

  const state = await getAiSuggestionState({
    entityType,
    entityId,
    surface: surface === "lead" ? "lead" : undefined,
  })
  return NextResponse.json(state)
}
