import { NextResponse } from "next/server"

import type { LeadStatus } from "@prisma/client"

import { db } from "@/lib/prisma"

import { LEAD_STATUSES } from "./board"

export async function patchLeadRecord(
  id: string,
  body: Record<string, unknown>
) {
  const existing = await db.contact.findUnique({
    where: { id },
    select: { id: true, leadSource: true, leadStatus: true, leadAt: true },
  })
  if (!existing)
    return NextResponse.json({ error: "not found" }, { status: 404 })
  if (existing.leadSource === null) {
    return NextResponse.json(
      { error: "contact is not a lead" },
      { status: 400 }
    )
  }

  const data: Record<string, unknown> = {}
  if (body.leadStatus !== undefined) {
    if (
      typeof body.leadStatus !== "string" ||
      !LEAD_STATUSES.includes(body.leadStatus as LeadStatus)
    ) {
      return NextResponse.json({ error: "invalid leadStatus" }, { status: 400 })
    }
    data.leadStatus = body.leadStatus
    if (
      existing.leadStatus === null &&
      existing.leadAt === null &&
      body.leadStatus === "new"
    ) {
      data.leadAt = new Date()
    }
  }
  if (body.notes !== undefined)
    data.notes = body.notes === null ? null : String(body.notes)

  const lead = await db.contact.update({ where: { id }, data })
  return NextResponse.json({ ok: true, lead })
}
