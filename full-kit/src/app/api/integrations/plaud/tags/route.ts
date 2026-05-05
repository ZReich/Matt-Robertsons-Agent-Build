import { NextResponse } from "next/server"

import { db } from "@/lib/prisma"
import {
  ReviewerAuthError,
  assertJsonRequest,
  assertSameOriginRequest,
  requireAgentReviewer,
} from "@/lib/reviewer-auth"

export const dynamic = "force-dynamic"

const TAG_MAP_KEY = "plaud:tag_map"

/**
 * Per-tag → contact mapping. Matt configures via the UI to make
 * "folder_tag" suggestions land on the right contact for tagged
 * recordings.
 *
 * GET — returns the current map.
 * POST — body { tagId, contactId } — set or clear (contactId=null) one entry.
 *        Atomic: read-modify-write under a single transaction.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    await requireAgentReviewer()
  } catch (err) {
    return errorResponse(err)
  }
  const row = await db.systemState.findUnique({ where: { key: TAG_MAP_KEY } })
  return NextResponse.json({
    map: (row?.value as Record<string, string> | null) ?? {},
  })
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOriginRequest(request)
    assertJsonRequest(request)
    await requireAgentReviewer()
  } catch (err) {
    return errorResponse(err)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const { tagId, contactId } = body as { tagId?: unknown; contactId?: unknown }
  if (typeof tagId !== "string" || tagId.length === 0 || tagId.length > 200) {
    return NextResponse.json({ error: "invalid_tagId" }, { status: 400 })
  }
  if (
    contactId !== null &&
    (typeof contactId !== "string" || contactId.length === 0)
  ) {
    return NextResponse.json({ error: "invalid_contactId" }, { status: 400 })
  }

  // Read-modify-write inside a transaction so concurrent updates don't lose
  // each other's entries.
  await db.$transaction(async (tx) => {
    const existing = await tx.systemState.findUnique({
      where: { key: TAG_MAP_KEY },
    })
    const map: Record<string, string> = Object.create(null)
    if (
      existing?.value &&
      typeof existing.value === "object" &&
      !Array.isArray(existing.value)
    ) {
      for (const [k, v] of Object.entries(
        existing.value as Record<string, unknown>
      )) {
        if (k === "__proto__" || k === "constructor" || k === "prototype")
          continue
        if (typeof v === "string" && v.length > 0) map[k] = v
      }
    }
    if (contactId === null) {
      delete map[tagId]
    } else {
      map[tagId] = contactId as string
    }
    await tx.systemState.upsert({
      where: { key: TAG_MAP_KEY },
      create: { key: TAG_MAP_KEY, value: map },
      update: { value: map },
    })
  })

  return NextResponse.json({ ok: true })
}

function errorResponse(err: unknown): Response {
  if (err instanceof ReviewerAuthError) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status }
    )
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 })
}
