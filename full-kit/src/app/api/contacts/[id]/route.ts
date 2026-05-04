import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import {
  requireApiUser,
  validateJsonMutationRequest,
} from "@/lib/api-route-auth"
import { db } from "@/lib/prisma"

interface RouteContext {
  params: Promise<{ id: string }>
}

const ALLOWED_TAGS = new Set<string>([
  "owner",
  "tenant",
  "buyer",
  "investor",
  "referrer",
  "referral",
  "christmas-mailer",
  "do-not-contact",
])

const MAX_TAGS_PER_CONTACT = 32

function sanitizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== "string") continue
    const tag = raw.trim().toLowerCase()
    if (!tag) continue
    if (tag.length > 64) continue
    if (seen.has(tag)) continue
    // Only allow [a-z0-9_-]+ for safety against display issues.
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= MAX_TAGS_PER_CONTACT) break
  }
  return out
}

function sanitizeNotes(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.replace(/\r\n/g, "\n").trim()
  // Cap at 64KB — if Matt's notes blow past this, that's a design conversation.
  if (trimmed.length > 65_535) {
    return trimmed.slice(0, 65_535)
  }
  return trimmed.length === 0 ? null : trimmed
}

function sanitizeSearchCriteria(
  value: unknown
): Prisma.InputJsonValue | null | undefined {
  if (value === null) return null
  if (typeof value !== "object" || value === undefined || Array.isArray(value))
    return undefined
  const input = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if (Array.isArray(input.propertyTypes)) {
    out.propertyTypes = input.propertyTypes.filter(
      (t): t is string => typeof t === "string"
    )
  }
  if (typeof input.minSqft === "number" && Number.isFinite(input.minSqft)) {
    out.minSqft = Math.max(0, Math.floor(input.minSqft))
  }
  if (typeof input.maxSqft === "number" && Number.isFinite(input.maxSqft)) {
    out.maxSqft = Math.max(0, Math.floor(input.maxSqft))
  }
  if (typeof input.minPrice === "number" && Number.isFinite(input.minPrice)) {
    out.minPrice = Math.max(0, input.minPrice)
  }
  if (typeof input.maxPrice === "number" && Number.isFinite(input.maxPrice)) {
    out.maxPrice = Math.max(0, input.maxPrice)
  }
  if (Array.isArray(input.locations)) {
    out.locations = input.locations
      .filter((l): l is string => typeof l === "string")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, 24)
  }
  if (typeof input.notes === "string") {
    out.notes = input.notes.trim().slice(0, 1024)
  }
  return out as Prisma.InputJsonValue
}

export async function GET(
  _request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params
  const contact = await db.contact.findUnique({ where: { id } })
  if (!contact)
    return NextResponse.json({ error: "not found" }, { status: 404 })
  return NextResponse.json({ contact })
}

export async function PATCH(
  request: Request,
  ctx: RouteContext
): Promise<Response> {
  const unauthorized = await requireApiUser()
  if (unauthorized) return unauthorized
  const invalidRequest = validateJsonMutationRequest(request)
  if (invalidRequest) return invalidRequest

  const { id } = await ctx.params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const data: Prisma.ContactUpdateInput = {}
  let touched = false

  if (Object.prototype.hasOwnProperty.call(body, "tags")) {
    const tags = sanitizeTags(body.tags)
    if (tags === null) {
      return NextResponse.json(
        { error: "tags must be an array of short strings" },
        { status: 400 }
      )
    }
    // Surface unknown tags only as a warning header — we still accept them
    // since the UI may add custom labels per Matt's request.
    const unknown = tags.filter((t) => !ALLOWED_TAGS.has(t))
    data.tags = tags
    touched = true
    if (unknown.length > 0) {
      // Log custom tags so we can review and add to the canonical set if useful.
      console.info("[contacts.patch] custom tags accepted:", unknown)
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    const notes = sanitizeNotes(body.notes)
    if (notes === undefined) {
      return NextResponse.json(
        { error: "notes must be a string or null" },
        { status: 400 }
      )
    }
    data.notes = notes
    touched = true
  }

  if (Object.prototype.hasOwnProperty.call(body, "searchCriteria")) {
    const criteria = sanitizeSearchCriteria(body.searchCriteria)
    if (criteria === undefined) {
      return NextResponse.json(
        { error: "searchCriteria must be an object or null" },
        { status: 400 }
      )
    }
    // Prisma represents JSON null with the DbNull sentinel; passing JS null
    // would be interpreted as JSON-value-null instead of "clear the column".
    data.searchCriteria = criteria === null ? Prisma.DbNull : criteria
    touched = true
  }

  if (!touched) {
    return NextResponse.json(
      { error: "no editable fields provided" },
      { status: 400 }
    )
  }

  const existing = await db.contact.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })

  const contact = await db.contact.update({ where: { id }, data })
  return NextResponse.json({ ok: true, contact })
}
