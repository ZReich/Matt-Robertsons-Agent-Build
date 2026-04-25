import { NextResponse } from "next/server"

import type { LeadStatus } from "@prisma/client"

import { db } from "@/lib/prisma"

const ALLOWED_STATUSES: LeadStatus[] = [
  "new",
  "vetted",
  "contacted",
  "converted",
  "dropped",
]

interface PatchBody {
  leadStatus?: LeadStatus
  notes?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (
    body.leadStatus !== undefined &&
    !ALLOWED_STATUSES.includes(body.leadStatus)
  ) {
    return NextResponse.json({ error: "invalid leadStatus" }, { status: 400 })
  }

  const existing = await db.contact.findUnique({
    where: { id },
    select: { id: true, leadSource: true },
  })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })
  if (existing.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 }
    )
  }

  const updated = await db.contact.update({
    where: { id },
    data: {
      ...(body.leadStatus !== undefined ? { leadStatus: body.leadStatus } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    select: {
      id: true,
      leadStatus: true,
      notes: true,
    },
  })

  return NextResponse.json({ ok: true, ...updated })
}
