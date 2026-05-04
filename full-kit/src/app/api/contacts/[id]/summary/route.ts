import { NextResponse } from "next/server"

import {
  ContactSummarizerError,
  getOrGenerateContactSummary,
} from "@/lib/ai/contact-summarizer"
import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const csrfRejection = validateJsonMutationRequest(request)
  if (csrfRejection) return csrfRejection

  const { id } = await params

  let body: { force?: boolean } = {}
  try {
    const text = await request.text()
    if (text.trim().length > 0) body = JSON.parse(text) as { force?: boolean }
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  try {
    const summary = await getOrGenerateContactSummary(id, {
      force: body.force === true,
    })
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    if (error instanceof ContactSummarizerError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 ? error.status : 500 }
      )
    }
    throw error
  }
}
