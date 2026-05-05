import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string; factId: string }>
}

// `contact_profile_facts.status` is `text` (not an enum), so any string is
// accepted at the DB layer. We constrain to the three values the UI
// understands: "active" (auto-saved or operator-confirmed), "review"
// (inferred, awaiting confirmation — the default for v7 inferred facts),
// and "dismissed" (operator rejected; never re-shown).
const ALLOWED_STATUSES = new Set(["active", "review", "dismissed"])

/**
 * Operator action to confirm or dismiss an AI-inferred profile fact.
 * Source surfaces: contact Personal tab and Relationship Profile card,
 * which now render review-status facts with inline Confirm / Dismiss
 * buttons (audit fix May 2026 — without this, v7 inferred facts at
 * confidence 0.3-0.85 are written but never visible to operators).
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized

  const invalid = validateJsonMutationRequest(request)
  if (invalid) return invalid

  const { id: contactId, factId } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const status =
    body && typeof body === "object" && "status" in body
      ? (body as { status: unknown }).status
      : null
  if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      {
        error: "invalid_status",
        allowed: Array.from(ALLOWED_STATUSES),
      },
      { status: 400 }
    )
  }

  try {
    const updated = await db.contactProfileFact.update({
      where: { id: factId, contactId },
      data: { status },
      select: { id: true, status: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }
    throw err
  }
}
